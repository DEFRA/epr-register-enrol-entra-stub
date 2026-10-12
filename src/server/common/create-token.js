import { SignJWT } from 'jose'
import { privateKey, publicJWK } from './keys.js'
import { issuer } from './oidc-config.js'

export const TOKEN_LIFETIME_SECONDS = 3600

/**
 * Sign a token for `user`, addressed to `clientId`. Entra ID omits the
 * `roles` claim entirely for a user with no app role, so this does too.
 */
export const createToken = ({ user, clientId, claims = {} }) =>
  new SignJWT({
    ...claims,
    sub: user.id,
    oid: user.id,
    name: user.name,
    preferred_username: user.username,
    email: user.username,
    ...(user.roles.length > 0 && { roles: user.roles })
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: publicJWK.kid })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(clientId)
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
    .sign(privateKey)
