import Boom from '@hapi/boom'
import { compactVerify, importJWK } from 'jose'
import { findClient } from '../common/clients.js'
import { publicJWK } from '../common/keys.js'
import { sessions } from './authorize.js'

const verificationKey = await importJWK(publicJWK, 'RS256')

// Entra ID identifies the app from id_token_hint (or client_id). An expired
// hint is still accepted, as Entra ID does, so only the signature is checked.
const findClientFromHint = async (idTokenHint) => {
  try {
    const { payload } = await compactVerify(idTokenHint, verificationKey)
    const { aud } = JSON.parse(new TextDecoder().decode(payload))
    return findClient(aud)
  } catch {
    throw Boom.badRequest('Invalid id_token_hint')
  }
}

export const logoutGet = {
  method: /** @type {const} */ ('GET'),
  path: '/logout',
  async handler(request, h) {
    const {
      id_token_hint: idTokenHint,
      client_id: clientId,
      post_logout_redirect_uri: postLogoutRedirectUri
    } = request.query

    const client = idTokenHint
      ? await findClientFromHint(idTokenHint)
      : findClient(clientId)
    if (!client) {
      throw Boom.badRequest('Invalid client_id')
    }

    if (!client.postLogoutRedirectURIs.includes(postLogoutRedirectUri)) {
      throw Boom.badRequest('Invalid post_logout_redirect_uri')
    }

    delete sessions[request.state.sessionId]
    h.unstate('sessionId', { path: '/' })
    return h.redirect(postLogoutRedirectUri)
  }
}
