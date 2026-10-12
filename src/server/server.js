import path from 'path'
import hapi from '@hapi/hapi'
import inert from '@hapi/inert'
import { secureContext } from '@defra/hapi-secure-context'

import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { metrics } from '@defra/cdp-metrics'
import { catchAll } from './common/helpers/errors.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'

import { health } from './routes/health.js'
import { jwks } from './routes/jwks.js'
import { token } from './routes/token.js'
import { favicon } from './routes/favicon.js'
import { files } from './routes/files.js'
import { authorizeGet, authorizePost } from './routes/authorize.js'
import { logoutGet } from './routes/logout.js'
import { oidcConfigGet } from './routes/openid-configuration.js'

export async function createServer() {
  setupProxy()
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    },
    state: {
      strictHeader: false
    }
  })

  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    nunjucksConfig,
    inert
  ])

  server.ext('onPreResponse', catchAll)

  server.route([
    favicon,
    files,
    health,
    jwks,
    authorizeGet,
    authorizePost,
    token,
    oidcConfigGet,
    logoutGet
  ])

  return server
}
