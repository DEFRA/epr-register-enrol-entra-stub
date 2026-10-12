import { config } from '../../config/config.js'

export const files = {
  method: /** @type {const} */ ('GET'),
  path: `${config.get('assetPath')}/{param*}`,
  options: {
    auth: /** @type {const} */ (false),
    cache: {
      expiresIn: config.get('staticCacheTimeout'),
      privacy: /** @type {const} */ ('private')
    }
  },
  handler: {
    directory: {
      path: '.',
      redirectToSlash: true
    }
  }
}
