import { config } from '../../config/config.js'
import { trimTrailingSlash } from './urls.js'

// Paths epr-register-enrol-management-fe registers for its Entra ID login
// (src/server/common/helpers/auth/providers/azure-entra-id.js) and sends as
// post_logout_redirect_uri (src/server/routes/auth/controller.js).
export const CM_CALLBACK_PATH = '/auth/regulator/callback'
export const CM_POST_LOGOUT_PATH = '/auth/logout'

const cmBaseUrl = trimTrailingSlash(config.get('caseManagement.callbackUrl'))

export const clients = [
  {
    id: config.get('caseManagement.clientId'),
    secret: config.get('caseManagement.clientSecret'),
    redirectURIs: [`${cmBaseUrl}${CM_CALLBACK_PATH}`],
    scopes: ['openid', 'profile', 'email'],
    postLogoutRedirectURIs: [`${cmBaseUrl}${CM_POST_LOGOUT_PATH}`]
  }
]

export const findClient = (clientId) => clients.find((c) => c.id === clientId)
