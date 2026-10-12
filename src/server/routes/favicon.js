import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

export const favicon = {
  options: {
    auth: /** @type {const} */ (false),
    cache: {
      expiresIn: config.get('staticCacheTimeout'),
      privacy: /** @type {const} */ ('private')
    }
  },
  method: /** @type {const} */ ('GET'),
  path: '/favicon.ico',
  handler(_request, h) {
    return h.response().code(statusCodes.noContent).type('image/x-icon')
  }
}
