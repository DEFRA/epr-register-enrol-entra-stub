import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync
} from 'node:crypto'
import { calculateJwkThumbprint, exportJWK } from 'jose'
import { config } from '../../config/config.js'

/**
 * Load the token signing key from a PKCS#8 PEM, or generate a fresh RSA key
 * pair when none is given. The public half is published on /jwks with a
 * thumbprint kid, so a rotated key gets a new kid.
 */
export async function loadSigningKeys(pem) {
  const privateKey = pem
    ? createPrivateKey(pem.replaceAll(String.raw`\n`, '\n'))
    : generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey

  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('STUB_SIGNING_KEY must be an RSA private key')
  }

  const jwk = await exportJWK(createPublicKey(privateKey))
  const kid = await calculateJwkThumbprint(jwk)

  return {
    privateKey,
    publicJWK: { ...jwk, kid, use: 'sig', alg: 'RS256' }
  }
}

export const { privateKey, publicJWK } = await loadSigningKeys(
  config.get('stub.signingKey')
)
