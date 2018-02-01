'use strict'

module.exports = {
  // Common http transaction trace attributes
  httpAttributes: [
    'request.headers.host',
    'request.method',
    'response.status',
    'httpResponseCode'
  ]
}
