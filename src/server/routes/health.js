export const health = {
  method: /** @type {const} */ ('GET'),
  path: '/health',
  handler() {
    return {
      message: 'success'
    }
  }
}
