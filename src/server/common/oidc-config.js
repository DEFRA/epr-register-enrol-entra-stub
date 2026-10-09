import { config } from '../../config/config.js'
import { trimTrailingSlash } from './urls.js'

// Browser-facing endpoints hang off the external URL, which is also the
// issuer; server-to-server endpoints hang off the internal URL.
const externalUrl = trimTrailingSlash(config.get('stub.externalUrl'))
const internalUrl = trimTrailingSlash(config.get('stub.internalUrl'))

export const issuer = externalUrl

export const oidcConfig = {
  issuer,
  authorization_endpoint: `${externalUrl}/authorize`,
  token_endpoint: `${internalUrl}/token`,
  jwks_uri: `${internalUrl}/jwks`,
  end_session_endpoint: `${externalUrl}/logout`,
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'profile', 'email'],
  token_endpoint_auth_methods_supported: ['client_secret_post'],
  code_challenge_methods_supported: ['S256'],
  claims_supported: [
    'iss',
    'sub',
    'aud',
    'exp',
    'iat',
    'nonce',
    'oid',
    'name',
    'preferred_username',
    'email',
    'roles'
  ]
}
