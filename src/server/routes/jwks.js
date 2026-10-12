import { publicJWK } from '../common/keys.js'

export const jwks = {
  method: /** @type {const} */ ('GET'),
  path: '/jwks',
  handler() {
    return {
      keys: [publicJWK]
    }
  }
}
