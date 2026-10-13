# epr-register-enrol-entra-stub

A Microsoft Entra ID OpenID Connect stub for the EPR Register Case Management
frontend ([epr-register-enrol-management-fe](https://github.com/DEFRA/epr-register-enrol-management-fe)).
It lets automated journey tests on CDP dev and perf-test sign in through
management-fe's real Entra ID code path (authorization code + PKCE, signed
`id_token`, RP-initiated logout) without real Entra ID accounts.

It is a stub: it holds no real accounts and must never be used by a
production service.

Forked from [epr-re-ex-entra-stub](https://github.com/DEFRA/epr-re-ex-entra-stub),
itself based on [fg-entra-stub-frontend](https://github.com/DEFRA/fg-entra-stub-frontend).

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Pointing management-fe at the stub](#pointing-management-fe-at-the-stub)
- [Endpoints](#endpoints)
- [Environment variables](#environment-variables)
- [Users](#users)
- [Signing keys](#signing-keys)
- [Running as a single instance](#running-as-a-single-instance)
- [Docker](#docker)
- [Licence](#licence)

## Requirements

- [Node.js](http://nodejs.org/) at the version in [.nvmrc](.nvmrc) (`nvm use`)

## Quick start

```bash
npm install
npm run dev
```

The stub listens on <http://localhost:3010>.

## Pointing management-fe at the stub

| management-fe setting    | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| Discovery document       | `${STUB_EXTERNAL_URL}/.well-known/openid-configuration`               |
| Issuer                   | `STUB_EXTERNAL_URL`, e.g. `http://localhost:3010` (no trailing slash) |
| `ENTRA_CLIENT_ID`        | `epr-register-enrol-management-fe`                                    |
| `ENTRA_CLIENT_SECRET`    | `case-management-stub-secret`                                         |
| `AUTH_CALLBACK_BASE_URL` | `CALLBACK_CM_URL` (default `http://localhost:3000`)                   |

The client id and secret are hard-coded in
[src/server/common/clients.js](src/server/common/clients.js), as in
epr-re-ex-entra-stub: there is no env var or portal secret for them. Set
management-fe's `ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET` (portal secrets)
to the values above.

The stub registers exactly one client, with exact-match URIs:

- redirect URI `${CALLBACK_CM_URL}/auth/regulator/callback`
- post-logout redirect URI `${CALLBACK_CM_URL}/auth/logout`

## Endpoints

| Endpoint                                | Purpose                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /.well-known/openid-configuration` | Discovery document. Every URL in it is built from `STUB_EXTERNAL_URL` / `STUB_INTERNAL_URL`. |
| `GET/POST /authorize`                   | Authorization endpoint and login form. `response_type=code` only; PKCE `S256` when sent.     |
| `POST /token`                           | Exchanges a code for an `id_token` and `access_token`. Client secret in the form body only.  |
| `GET /jwks`                             | Public signing key.                                                                          |
| `GET /logout`                           | End-session endpoint. Takes `id_token_hint` (or `client_id`) and `post_logout_redirect_uri`. |
| `GET /health`                           | CDP health check.                                                                            |

`/authorize` and `/logout` are reached by the browser, so the discovery
document advertises them on `STUB_EXTERNAL_URL`; `/token` and `/jwks` are
called server to server and are advertised on `STUB_INTERNAL_URL`.

`/token` returns:

- `id_token`, signed RS256, with `iss`, `aud` (the client id), `sub`, `oid`,
  `name`, `preferred_username`, `email`, `roles`, `iat`, `exp` and the `nonce`
  sent to `/authorize`. As in Entra ID, `roles` is omitted for a user with no
  app role.
- `access_token` with the same identity claims plus `scope`.

Errors from `/token` are RFC 6749 JSON (`{ "error": "invalid_grant", ... }`).

## Environment variables

| Variable            | Default                 | Purpose                                                                                            |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `STUB_EXTERNAL_URL` | `http://localhost:3010` | Browser-facing base URL; also the issuer (`iss` and discovery `issuer`).                           |
| `STUB_INTERNAL_URL` | `http://localhost:3010` | Server-to-server base URL for `token_endpoint` and `jwks_uri`. Same as `STUB_EXTERNAL_URL` on CDP. |
| `CALLBACK_CM_URL`   | `http://localhost:3000` | Case Management base URL; the registered redirect and post-logout URIs hang off it.                |
| `STUB_SIGNING_KEY`  | unset                   | Optional RSA PKCS#8 PEM to sign tokens with. Unset: a key pair is generated at boot.               |
| `PORT`              | `3010`                  | Port to listen on.                                                                                 |

The usual CDP template variables (`LOG_LEVEL`, `HTTP_PROXY`,
`ENABLE_SECURE_CONTEXT`, ...) are documented in
[src/config/config.js](src/config/config.js).

## Users

Every user's password is `pass`. Ids are stable, so `oid`/`sub` do not change
between runs.

| Email                          | Name           | Entra ID app role            | management-fe outcome    |
| ------------------------------ | -------------- | ---------------------------- | ------------------------ |
| `ea.regulator@test.gov.uk`     | EA Regulator   | `Waste.Regulator.Standard`   | Caseworker               |
| `nrw.regulator@test.gov.uk`    | NRW Regulator  | `Waste.Regulator.Standard`   | Caseworker               |
| `niea.regulator@test.gov.uk`   | NIEA Regulator | `Waste.Regulator.Standard`   | Caseworker               |
| `sepa.regulator@test.gov.uk`   | SEPA Regulator | `Waste.Regulator.Standard`   | Caseworker               |
| `support.readonly@test.gov.uk` | Support User   | `Waste.SupportUser.ReadOnly` | Read-only support user   |
| `no.role@test.gov.uk`          | No Role User   | none                         | "You do not have access" |

Users are defined in [src/server/common/users.js](src/server/common/users.js)
and the client in [src/server/common/clients.js](src/server/common/clients.js).

## Signing keys

No private key is committed. Unless `STUB_SIGNING_KEY` is set, the stub
generates an RSA key pair at boot and publishes the public half on `/jwks`
(the `kid` is its JWK thumbprint). management-fe verifies with jose's remote
JWKS set, which re-fetches on an unknown `kid`, so a restart is harmless for new logins; tokens
issued before the restart no longer verify, which also means `/logout`
rejects their `id_token_hint`. Set `STUB_SIGNING_KEY` to keep a key across
restarts. Literal `\n` sequences in the value are turned into newlines.

## Running as a single instance

Browser sessions and authorization codes are held in memory, so the stub
must run as **one instance**: a code issued by one instance cannot be
redeemed at another. A restart signs every stub session out.

## Docker

### Development

```bash
docker build --target development --tag epr-register-enrol-entra-stub:dev .
docker run -p 3010:3010 epr-register-enrol-entra-stub:dev
```

### Production

```bash
docker build --tag epr-register-enrol-entra-stub .
docker run -p 3010:3010 epr-register-enrol-entra-stub
```

### With Docker Compose

```bash
docker compose up --build -d
```

[compose.yml](compose.yml) sets `STUB_INTERNAL_URL` to the container's
hostname on the `cdp-tenant` network, so a management-fe container on the
same network can reach `/token` and `/jwks`, while browsers use
`http://localhost:3010`.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
