import { generateKeyPairSync } from 'node:crypto'
import { loadSigningKeys } from './keys.js'

describe('#loadSigningKeys', () => {
  test('generates an RSA key pair when no PEM is configured', async () => {
    const first = await loadSigningKeys(null)
    const second = await loadSigningKeys(null)

    expect(first.privateKey.asymmetricKeyType).toBe('rsa')
    expect(first.publicJWK).toEqual(
      expect.objectContaining({ kty: 'RSA', alg: 'RS256', use: 'sig' })
    )
    expect(first.publicJWK).not.toHaveProperty('d')
    expect(first.publicJWK.kid).not.toBe(second.publicJWK.kid)
  })

  test('uses a configured PEM, including one with escaped newlines', async () => {
    const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString()

    const fromPem = await loadSigningKeys(pem)
    const fromEscaped = await loadSigningKeys(pem.replaceAll('\n', '\\n'))

    expect(fromEscaped.publicJWK).toEqual(fromPem.publicJWK)
  })

  test('rejects a non-RSA key', async () => {
    const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString()

    await expect(loadSigningKeys(pem)).rejects.toThrow(
      'STUB_SIGNING_KEY must be an RSA private key'
    )
  })
})
