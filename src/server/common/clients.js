import { config } from '../../config/config.js'
import { trimTrailingSlash } from './urls.js'

// Paths epr-register-enrol-management-fe registers for its Entra ID login
// (src/server/common/helpers/auth/providers/azure-entra-id.js) and sends as
// post_logout_redirect_uri (src/server/routes/auth/controller.js).
export const CM_CALLBACK_PATH = '/auth/regulator/callback'
export const CM_POST_LOGOUT_PATH = '/auth/logout'

// Paths epr-register-enrol-admin registers for its Entra ID sign-in.
export const ADMIN_CALLBACK_PATH = '/auth/callback'
export const ADMIN_POST_LOGOUT_PATH = '/auth/signed-out'

// Hard-coded, like epr-re-ex-entra-stub's client: this is a test stub, so
// the credentials protect nothing real. Each relying party's ENTRA_CLIENT_ID
// and ENTRA_CLIENT_SECRET must equal these on any environment using the stub.
const CM_CLIENT_ID = 'epr-register-enrol-management-fe'
const CM_CLIENT_SECRET = 'case-management-stub-secret'
const ADMIN_CLIENT_ID = 'epr-register-enrol-admin'
const ADMIN_CLIENT_SECRET = 'admin-stub-secret'

const cmBaseUrl = trimTrailingSlash(config.get('caseManagement.callbackUrl'))
const adminBaseUrl = trimTrailingSlash(config.get('admin.callbackUrl'))

export const clients = [
  {
    id: CM_CLIENT_ID,
    secret: CM_CLIENT_SECRET,
    redirectURIs: [`${cmBaseUrl}${CM_CALLBACK_PATH}`],
    scopes: ['openid', 'profile', 'email'],
    postLogoutRedirectURIs: [`${cmBaseUrl}${CM_POST_LOGOUT_PATH}`]
  },
  {
    id: ADMIN_CLIENT_ID,
    secret: ADMIN_CLIENT_SECRET,
    redirectURIs: [`${adminBaseUrl}${ADMIN_CALLBACK_PATH}`],
    scopes: ['openid', 'profile', 'email'],
    postLogoutRedirectURIs: [`${adminBaseUrl}${ADMIN_POST_LOGOUT_PATH}`]
  }
]

export const findClient = (clientId) => clients.find((c) => c.id === clientId)
