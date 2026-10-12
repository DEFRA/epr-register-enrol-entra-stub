import { statusCodes } from '../constants/status-codes.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    default:
      return 'Something went wrong'
  }
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode
  const errorMessage = statusCodeMessage(statusCode)

  const isBadRequest = statusCode === statusCodes.badRequest
  const isForbidden = statusCode === statusCodes.forbidden
  const isUnauthorized = statusCode === statusCodes.unauthorized
  const isInternalServerError = statusCode >= statusCodes.internalServerError

  if (isBadRequest || isUnauthorized || isForbidden || isInternalServerError) {
    request.logger.error(response?.stack)
  }

  return h
    .view('views/error', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage
    })
    .code(statusCode)
}
