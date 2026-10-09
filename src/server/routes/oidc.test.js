import { createHash, randomBytes } from 'node:crypto'
import { createLocalJWKSet, decodeJwt, jwtVerify } from 'jose'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { users } from '../common/users.js'

const CLIENT_ID = 'epr-register-enrol-management-fe'
const CLIENT_SECRET = 'case-management-stub-secret'
const REDIRECT_URI = 'http://localhost:3000/auth/regulator/callback'
const POST_LOGOUT_URI = 'http://localhost:3000/auth/logout'
const EA_REGULATOR = 'ea.regulator@test.gov.uk'

const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
const s256 = (verifier) =>
  createHash('sha256').update(verifier).digest('base64url')

describe('OIDC authorization code flow', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  // Mirrors epr-register-enrol-management-fe's regulatorLogin request.
  const authorizeQuery = (overrides = {}) => {
    const verifier = randomToken(64)
    const params = {
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'openid profile email',
      state: randomToken(),
      nonce: randomToken(),
      code_challenge: s256(verifier),
      code_challenge_method: 'S256',
      ...overrides
    }
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        delete params[key]
      }
    }
    return { params, verifier, query: new URLSearchParams(params).toString() }
  }

  const login = async (query, username = EA_REGULATOR, password = 'pass') =>
    server.inject({
      method: 'POST',
      url: `/authorize?${query}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ username, password }).toString()
    })

  const codeFrom = (response) =>
    new URL(response.headers.location).searchParams.get('code')

  const exchange = (payload) =>
    server.inject({
      method: 'POST',
      url: '/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        ...payload
      }).toString()
    })

  const discovery = async () =>
    (await server.inject('/.well-known/openid-configuration')).result

  const verifyIdToken = async (idToken, nonce) => {
    const { result: jwks } = await server.inject('/jwks')
    const { issuer } = await discovery()
    const { payload } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
      issuer,
      audience: CLIENT_ID
    })
    expect(payload.nonce).toBe(nonce)
    return payload
  }

  const fullLogin = async (username = EA_REGULATOR) => {
    const { params, verifier, query } = authorizeQuery()
    const loginResponse = await login(query, username)
    const tokenResponse = await exchange({
      code: codeFrom(loginResponse),
      code_verifier: verifier
    })
    return { params, loginResponse, tokenResponse }
  }

  describe('discovery document', () => {
    test('is consistent with the issuer and the endpoints actually served', async () => {
      const doc = await discovery()

      expect(doc).toEqual(
        expect.objectContaining({
          issuer: 'http://localhost:3010',
          authorization_endpoint: 'http://localhost:3010/authorize',
          token_endpoint: 'http://localhost:3010/token',
          jwks_uri: 'http://localhost:3010/jwks',
          end_session_endpoint: 'http://localhost:3010/logout',
          response_types_supported: ['code'],
          token_endpoint_auth_methods_supported: ['client_secret_post'],
          code_challenge_methods_supported: ['S256']
        })
      )

      for (const key of [
        'authorization_endpoint',
        'token_endpoint',
        'jwks_uri',
        'end_session_endpoint'
      ]) {
        const { pathname } = new URL(doc[key])
        const method = key === 'token_endpoint' ? 'POST' : 'GET'
        expect(server.match(method, pathname)).not.toBeNull()
      }
    })

    test('jwks publishes the key that signs issued tokens', async () => {
      const { result: jwks } = await server.inject('/jwks')
      const { tokenResponse } = await fullLogin()
      const { kid } = JSON.parse(
        Buffer.from(
          tokenResponse.result.id_token.split('.')[0],
          'base64url'
        ).toString()
      )

      expect(jwks.keys).toHaveLength(1)
      expect(jwks.keys[0]).toEqual(
        expect.objectContaining({ kty: 'RSA', alg: 'RS256', use: 'sig', kid })
      )
      expect(jwks.keys[0]).not.toHaveProperty('d')
    })
  })

  describe('/authorize', () => {
    test('renders the login page for a valid request', async () => {
      const { statusCode, result } = await server.inject(
        `/authorize?${authorizeQuery().query}`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Entra ID stub')
    })

    test.each([
      ['an unregistered redirect_uri', { redirect_uri: 'http://evil.test/cb' }],
      [
        'a redirect_uri that only prefixes the registered one',
        { redirect_uri: `${REDIRECT_URI}/extra` }
      ],
      ['an unknown client_id', { client_id: 'someone-else' }],
      ['an unsupported response_type', { response_type: 'token' }],
      ['an unregistered scope', { scope: 'openid offline_access' }],
      ['no state', { state: undefined }],
      ['a plain code_challenge_method', { code_challenge_method: 'plain' }],
      ['a malformed code_challenge', { code_challenge: 'too-short' }]
    ])('rejects %s', async (_label, overrides) => {
      const { query } = authorizeQuery(overrides)

      const getResponse = await server.inject(`/authorize?${query}`)
      const postResponse = await login(query)

      expect(getResponse.statusCode).toBe(statusCodes.badRequest)
      expect(postResponse.statusCode).toBe(statusCodes.badRequest)
    })

    test('re-renders the login page for bad credentials', async () => {
      const response = await login(authorizeQuery().query, EA_REGULATOR, 'no')

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(response.result).toContain('Invalid email or password')
    })

    test('redirects to the registered redirect_uri with code and state', async () => {
      const { params, query } = authorizeQuery()

      const response = await login(query)
      const location = new URL(response.headers.location)

      expect(response.statusCode).toBe(302)
      expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI)
      expect(location.searchParams.get('state')).toBe(params.state)
      expect(location.searchParams.get('code')).toEqual(expect.any(String))
    })

    test('reuses the browser session to issue a code without a login form', async () => {
      const loginResponse = await login(authorizeQuery().query)
      const cookie = loginResponse.headers['set-cookie'][0].split(';')[0]
      const { params, verifier, query } = authorizeQuery()

      const response = await server.inject({
        url: `/authorize?${query}`,
        headers: { cookie }
      })
      const tokenResponse = await exchange({
        code: codeFrom(response),
        code_verifier: verifier
      })

      expect(response.statusCode).toBe(302)
      await verifyIdToken(tokenResponse.result.id_token, params.nonce)
    })
  })

  describe('/token', () => {
    test('returns a signed id_token and access_token', async () => {
      const { tokenResponse } = await fullLogin()

      expect(tokenResponse.statusCode).toBe(statusCodes.ok)
      expect(tokenResponse.headers['cache-control']).toBe('no-store')
      expect(tokenResponse.result).toEqual({
        access_token: expect.any(String),
        id_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email'
      })
    })

    test('id_token carries the identity claims management-fe reads and echoes the nonce', async () => {
      const { params, tokenResponse } = await fullLogin()
      const user = users.find((u) => u.username === EA_REGULATOR)

      const claims = await verifyIdToken(
        tokenResponse.result.id_token,
        params.nonce
      )

      expect(claims).toEqual({
        iss: 'http://localhost:3010',
        aud: CLIENT_ID,
        sub: user.id,
        oid: user.id,
        name: 'EA Regulator',
        preferred_username: EA_REGULATOR,
        email: EA_REGULATOR,
        roles: ['Waste.Regulator.Standard'],
        nonce: params.nonce,
        iat: expect.any(Number),
        exp: expect.any(Number)
      })
      expect(claims.exp - claims.iat).toBe(3600)
    })

    test('access_token carries the granted scope and no nonce', async () => {
      const { tokenResponse } = await fullLogin()

      const claims = decodeJwt(tokenResponse.result.access_token)

      expect(claims.scope).toBe('openid profile email')
      expect(claims).not.toHaveProperty('nonce')
    })

    test.each([
      ['support.readonly@test.gov.uk', ['Waste.SupportUser.ReadOnly']],
      ['sepa.regulator@test.gov.uk', ['Waste.Regulator.Standard']]
    ])('issues %s the roles %j', async (username, roles) => {
      const { params, tokenResponse } = await fullLogin(username)

      const claims = await verifyIdToken(
        tokenResponse.result.id_token,
        params.nonce
      )

      expect(claims.roles).toEqual(roles)
    })

    test('omits the roles claim for a user with no app role', async () => {
      const { params, tokenResponse } = await fullLogin('no.role@test.gov.uk')

      const claims = await verifyIdToken(
        tokenResponse.result.id_token,
        params.nonce
      )

      expect(claims).not.toHaveProperty('roles')
    })

    test('omits nonce when the authorization request had none', async () => {
      const { query } = authorizeQuery({
        nonce: undefined,
        code_challenge: undefined,
        code_challenge_method: undefined
      })
      const response = await exchange({ code: codeFrom(await login(query)) })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(decodeJwt(response.result.id_token)).not.toHaveProperty('nonce')
    })

    describe('PKCE', () => {
      test('rejects a code_verifier that does not match the challenge', async () => {
        const { query } = authorizeQuery()
        const code = codeFrom(await login(query))

        const response = await exchange({ code, code_verifier: randomToken() })

        expect(response.statusCode).toBe(statusCodes.badRequest)
        expect(response.result).toEqual({
          error: 'invalid_grant',
          error_description: 'PKCE verification failed'
        })
      })

      test('rejects a missing code_verifier when a challenge was sent', async () => {
        const { query } = authorizeQuery()
        const code = codeFrom(await login(query))

        const response = await exchange({ code })

        expect(response.statusCode).toBe(statusCodes.badRequest)
        expect(response.result.error).toBe('invalid_grant')
      })
    })

    test.each([
      [
        'a wrong client_secret',
        { client_secret: 'wrong' },
        statusCodes.unauthorized,
        'invalid_client'
      ],
      [
        'an unknown client_id',
        { client_id: 'someone-else' },
        statusCodes.unauthorized,
        'invalid_client'
      ],
      [
        'an unsupported grant_type',
        { grant_type: 'client_credentials' },
        statusCodes.badRequest,
        'unsupported_grant_type'
      ],
      [
        'a redirect_uri that differs from the authorization request',
        { redirect_uri: 'http://localhost:3000/elsewhere' },
        statusCodes.badRequest,
        'invalid_grant'
      ]
    ])('rejects %s', async (_label, overrides, statusCode, error) => {
      const { verifier, query } = authorizeQuery()
      const code = codeFrom(await login(query))

      const response = await exchange({
        code,
        code_verifier: verifier,
        ...overrides
      })

      expect(response.statusCode).toBe(statusCode)
      expect(response.result.error).toBe(error)
    })

    test('rejects an unknown code and a reused code', async () => {
      const { verifier, query } = authorizeQuery()
      const code = codeFrom(await login(query))
      await exchange({ code, code_verifier: verifier })

      const reused = await exchange({ code, code_verifier: verifier })
      const unknown = await exchange({ code: 'nope', code_verifier: verifier })

      expect(reused.statusCode).toBe(statusCodes.badRequest)
      expect(reused.result.error).toBe('invalid_grant')
      expect(unknown.result.error).toBe('invalid_grant')
    })
  })

  describe('/logout', () => {
    // Mirrors epr-register-enrol-management-fe's logout redirect.
    const logout = (query, cookie) =>
      server.inject({
        url: `/logout?${new URLSearchParams(query)}`,
        headers: cookie ? { cookie } : {}
      })

    test('ends the browser session and redirects to the registered post-logout URI', async () => {
      const { loginResponse, tokenResponse } = await fullLogin()
      const cookie = loginResponse.headers['set-cookie'][0].split(';')[0]

      const response = await logout(
        {
          id_token_hint: tokenResponse.result.id_token,
          post_logout_redirect_uri: POST_LOGOUT_URI
        },
        cookie
      )
      const afterLogout = await server.inject({
        url: `/authorize?${authorizeQuery().query}`,
        headers: { cookie }
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe(POST_LOGOUT_URI)
      expect(response.headers['set-cookie'][0]).toMatch(/^sessionId=;/)
      expect(afterLogout.statusCode).toBe(statusCodes.ok)
      expect(afterLogout.result).toContain('Entra ID stub')
    })

    test('identifies the client from client_id when there is no id_token_hint', async () => {
      const response = await logout({
        client_id: CLIENT_ID,
        post_logout_redirect_uri: POST_LOGOUT_URI
      })

      expect(response.headers.location).toBe(POST_LOGOUT_URI)
    })

    test.each([
      [
        'an unregistered post_logout_redirect_uri',
        { client_id: CLIENT_ID, post_logout_redirect_uri: 'http://evil.test/' }
      ],
      ['a missing post_logout_redirect_uri', { client_id: CLIENT_ID }],
      [
        'an unknown client',
        { client_id: 'someone-else', post_logout_redirect_uri: POST_LOGOUT_URI }
      ],
      [
        'an id_token_hint not signed by this stub',
        {
          id_token_hint: 'eyJhbGciOiJSUzI1NiJ9.e30.c2ln',
          post_logout_redirect_uri: POST_LOGOUT_URI
        }
      ]
    ])('rejects %s', async (_label, query) => {
      const response = await logout(query)

      expect(response.statusCode).toBe(statusCodes.badRequest)
    })
  })
})
