import { createHash } from 'node:crypto'
import { authCodes } from '../common/auth-codes.js'
import { findClient } from '../common/clients.js'
import { createToken, TOKEN_LIFETIME_SECONDS } from '../common/create-token.js'
import { statusCodes } from '../common/constants/status-codes.js'

// RFC 6749 section 5.2 error response: JSON, not the HTML error page the
// onPreResponse handler renders for Boom errors.
const oauthError = (h, statusCode, error, errorDescription) =>
  h
    .response({ error, error_description: errorDescription })
    .code(statusCode)
    .header('Cache-Control', 'no-store')

const s256 = (verifier) =>
  createHash('sha256').update(verifier).digest('base64url')

export const token = {
  method: /** @type {const} */ ('POST'),
  path: '/token',
  async handler(request, h) {
    const {
      code,
      grant_type: grantType,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    } = request.payload ?? {}

    if (grantType !== 'authorization_code') {
      return oauthError(
        h,
        statusCodes.badRequest,
        'unsupported_grant_type',
        'Only authorization_code is supported'
      )
    }

    const client = findClient(clientId)
    if (!client || client.secret !== clientSecret) {
      return oauthError(
        h,
        statusCodes.unauthorized,
        'invalid_client',
        'Invalid client_id or client_secret'
      )
    }

    const authCode = authCodes[code]
    // Codes are single use, whether or not this exchange succeeds.
    delete authCodes[code]

    if (!authCode || authCode.clientId !== clientId) {
      return oauthError(
        h,
        statusCodes.badRequest,
        'invalid_grant',
        'Invalid or expired authorization code'
      )
    }

    if (authCode.redirectUri !== redirectUri) {
      return oauthError(
        h,
        statusCodes.badRequest,
        'invalid_grant',
        'redirect_uri does not match the authorization request'
      )
    }

    if (
      authCode.codeChallenge !== undefined &&
      (typeof codeVerifier !== 'string' ||
        s256(codeVerifier) !== authCode.codeChallenge)
    ) {
      return oauthError(
        h,
        statusCodes.badRequest,
        'invalid_grant',
        'PKCE verification failed'
      )
    }

    const { user, scope, nonce } = authCode
    const [accessToken, idToken] = await Promise.all([
      createToken({ user, clientId, claims: { scope } }),
      createToken({ user, clientId, claims: nonce ? { nonce } : {} })
    ])

    return h
      .response({
        access_token: accessToken,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: TOKEN_LIFETIME_SECONDS,
        scope
      })
      .header('Cache-Control', 'no-store')
  }
}
