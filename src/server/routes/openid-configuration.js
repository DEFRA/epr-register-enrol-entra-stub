import { oidcConfig } from '../common/oidc-config.js'

export const oidcConfigGet = {
  method: /** @type {const} */ ('GET'),
  path: '/.well-known/openid-configuration',
  handler() {
    return oidcConfig
  }
}
