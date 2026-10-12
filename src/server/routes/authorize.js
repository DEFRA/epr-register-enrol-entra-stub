import Boom from '@hapi/boom'
import { randomUUID } from 'node:crypto'
import { authCodes } from '../common/auth-codes.js'
import { findClient } from '../common/clients.js'
import { findUser } from '../common/users.js'

// Browser sessions (single sign-on between /authorize calls). Held in memory:
// the stub runs as a single instance and a restart simply logs everyone out.
export const sessions = {}

// A base64url SHA-256 digest is always 43 characters (RFC 7636 section 4.2).
const S256_CHALLENGE = /^[\w-]{43}$/

const assertIsValidQuery = (query) => {
  const client = findClient(query.client_id)
  if (!client) {
    throw Boom.badRequest('Invalid client_id')
  }

  if (!client.redirectURIs.includes(query.redirect_uri)) {
    throw Boom.badRequest('Invalid redirect_uri')
  }

  if (query.response_type !== 'code') {
    throw Boom.badRequest('Unsupported response_type')
  }

  if (typeof query.scope !== 'string') {
    throw Boom.badRequest('Invalid scope parameter type')
  }

  for (const scope of query.scope.split(' ')) {
    if (!client.scopes.includes(scope)) {
      throw Boom.badRequest(`Invalid scope: ${scope}`)
    }
  }

  if (!query.state) {
    throw Boom.badRequest('Missing state parameter')
  }

  if (query.code_challenge !== undefined) {
    if (query.code_challenge_method !== 'S256') {
      throw Boom.badRequest('Unsupported code_challenge_method')
    }
    if (!S256_CHALLENGE.test(query.code_challenge)) {
      throw Boom.badRequest('Invalid code_challenge')
    }
  }
}

const redirectWithCode = (h, query, user) => {
  const code = randomUUID()
  authCodes[code] = {
    clientId: query.client_id,
    redirectUri: query.redirect_uri,
    scope: query.scope,
    nonce: query.nonce,
    codeChallenge: query.code_challenge,
    user
  }

  const location = new URL(query.redirect_uri)
  location.searchParams.set('code', code)
  location.searchParams.set('state', query.state)
  return h.redirect(location.href)
}

const loginView = (h, validationErrors) =>
  h.view('views/authorize', {
    pageTitle: 'Login',
    heading: 'Login',
    validationErrors
  })

export const authorizeGet = {
  method: /** @type {const} */ ('GET'),
  path: '/authorize',
  handler(request, h) {
    assertIsValidQuery(request.query)

    const session = sessions[request.state.sessionId]
    if (session) {
      return redirectWithCode(h, request.query, session.user)
    }

    return loginView(h)
  }
}

export const authorizePost = {
  method: /** @type {const} */ ('POST'),
  path: '/authorize',
  handler(request, h) {
    assertIsValidQuery(request.query)

    const { username, password } = request.payload ?? {}
    const user = findUser(username, password)
    if (!user) {
      return loginView(h, [
        { text: 'Invalid email or password', href: '#username' }
      ])
    }

    const sessionId = randomUUID()
    sessions[sessionId] = { user }
    h.state('sessionId', sessionId, { path: '/' })

    return redirectWithCode(h, request.query, user)
  }
}
