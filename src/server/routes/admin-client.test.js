import { createHash, randomBytes } from 'node:crypto'
import { createLocalJWKSet, jwtVerify } from 'jose'

import { createServer } from '../server.js'

// Mirrors epr-register-enrol-admin's sign-in, as epr-register-enrol-admin
// sends it: openid-client's authorization code flow with PKCE and a nonce.
const CLIENT_ID = 'epr-register-enrol-admin'
const CLIENT_SECRET = 'admin-stub-secret'
const REDIRECT_URI = 'http://localhost:3000/auth/callback'
const POST_LOGOUT_URI = 'http://localhost:3000/auth/signed-out'

const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
const s256 = (verifier) =>
  createHash('sha256').update(verifier).digest('base64url')

describe('Admin UI client', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const signIn = async (username, redirectUri = REDIRECT_URI) => {
    const verifier = randomToken(64)
    const nonce = randomToken()
    const query = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state: randomToken(),
      nonce,
      code_challenge: s256(verifier),
      code_challenge_method: 'S256'
    })
    const loginResponse = await server.inject({
      method: 'POST',
      url: `/authorize?${query}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ username, password: 'pass' }).toString()
    })
    return { loginResponse, verifier, nonce }
  }

  const exchange = (loginResponse, verifier) =>
    server.inject({
      method: 'POST',
      url: '/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code: new URL(loginResponse.headers.location).searchParams.get('code'),
        code_verifier: verifier
      }).toString()
    })

  const verifyIdToken = async (idToken) => {
    const { result: jwks } = await server.inject('/jwks')
    const { result: discovery } = await server.inject(
      '/.well-known/openid-configuration'
    )
    const { payload } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
      issuer: discovery.issuer,
      audience: CLIENT_ID
    })
    return payload
  }

  test('signs the support user in with the read-only support role', async () => {
    const { loginResponse, verifier, nonce } = await signIn(
      'support.readonly@test.gov.uk'
    )
    const tokenResponse = await exchange(loginResponse, verifier)
    const idToken = await verifyIdToken(tokenResponse.result.id_token)

    expect(loginResponse.headers.location).toMatch(
      new RegExp(`^${REDIRECT_URI}\\?`)
    )
    expect(idToken).toMatchObject({
      aud: CLIENT_ID,
      nonce,
      preferred_username: 'support.readonly@test.gov.uk',
      roles: ['Waste.SupportUser.ReadOnly']
    })
  })

  test('signs a user with no app role in without a roles claim', async () => {
    const { loginResponse, verifier } = await signIn('no.role@test.gov.uk')
    const tokenResponse = await exchange(loginResponse, verifier)
    const idToken = await verifyIdToken(tokenResponse.result.id_token)

    expect(idToken.preferred_username).toBe('no.role@test.gov.uk')
    expect(idToken).not.toHaveProperty('roles')
  })

  test("refuses Case Management's redirect URI for the Admin UI client", async () => {
    const { loginResponse } = await signIn(
      'support.readonly@test.gov.uk',
      'http://localhost:3000/auth/regulator/callback'
    )

    expect(loginResponse.statusCode).toBe(400)
  })

  test('signs out to the Admin UI signed-out page', async () => {
    const response = await server.inject({
      url: `/logout?${new URLSearchParams({
        client_id: CLIENT_ID,
        post_logout_redirect_uri: POST_LOGOUT_URI
      })}`
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(POST_LOGOUT_URI)
  })
})
