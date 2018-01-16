'use strict'

module.exports = {
  // Common http transaction trace attributes
  httpAttributes: [
    'request.headers.host',
    'request.method',
    'request.headers.connection',
    'response.status',
    'httpResponseCode',
    'httpResponseMessage'
  ]
}
