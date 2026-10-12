import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3010,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'epr-register-enrol-entra-stub'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  stub: {
    externalUrl: {
      doc: 'Base URL browsers use to reach this stub. Also the OIDC issuer (discovery `issuer` and token `iss`) and the base of the authorize and end-session endpoints.',
      format: 'url',
      default: 'http://localhost:3010',
      env: 'STUB_EXTERNAL_URL'
    },
    internalUrl: {
      doc: 'Base URL relying parties use for server-to-server calls (token endpoint and JWKS). The same as STUB_EXTERNAL_URL on CDP; differs only where browser and server see different hostnames (e.g. Docker Compose).',
      format: 'url',
      default: 'http://localhost:3010',
      env: 'STUB_INTERNAL_URL'
    },
    signingKey: {
      doc: 'Optional RSA private key (PKCS#8 PEM; literal "\\n" sequences are accepted) used to sign tokens. When unset a fresh key pair is generated at boot, so tokens issued before a restart stop verifying.',
      format: String,
      nullable: true,
      default: null,
      env: 'STUB_SIGNING_KEY',
      sensitive: true
    }
  },
  caseManagement: {
    clientId: {
      doc: 'Client id of the EPR Register Case Management frontend (its ENTRA_CLIENT_ID).',
      format: String,
      default: 'epr-register-enrol-management-fe',
      env: 'CM_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Client secret of the EPR Register Case Management frontend (its ENTRA_CLIENT_SECRET). The default is a non-sensitive test value.',
      format: String,
      default: 'case-management-stub-secret',
      env: 'CM_CLIENT_SECRET',
      sensitive: true
    },
    callbackUrl: {
      doc: 'Base URL of the EPR Register Case Management frontend (its AUTH_CALLBACK_BASE_URL). The registered redirect and post-logout URIs are built from it.',
      format: 'url',
      default: 'http://localhost:3000',
      env: 'CALLBACK_CM_URL'
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  }
})

config.validate({ allowed: 'strict' })
