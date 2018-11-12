'use strict'

module.exports = function initialize(agent, AWS, moduleName, shim) {
  if (!shim.isFunction(AWS.NodeHttpClient)) {
    shim.logger.debug('Could not find NodeHttpClient, not instrumenting.')
    return false
  }

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
