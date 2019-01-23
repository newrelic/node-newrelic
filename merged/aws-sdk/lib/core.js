'use strict'

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.NodeHttpClient)) {
    shim.logger.debug('Could not find NodeHttpClient, not instrumenting.')
    return false
  }
  return true
}

function instrument(shim, AWS) {
  shim.wrap(AWS.NodeHttpClient.prototype, 'handleRequest', wrapHandleRequest)
}

function wrapHandleRequest(shim, handleRequest) {
  return function wrappedHandleRequest(httpRequest) {
    if (httpRequest) {
      if (!httpRequest.headers) {
        httpRequest.headers = Object.create(null)
      }
      httpRequest.headers[shim.DISABLE_DT] = true
    } else {
      shim.logger.debug('Unknown arguments to AWS.NodeHttpClient#handleRequest!')
    }

    return handleRequest.apply(this, arguments)
  }
}

module.exports = {
  name: 'core',
  type: 'generic',
  validate,
  instrument
}
