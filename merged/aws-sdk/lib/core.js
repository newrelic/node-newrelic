'use strict'

const UNKNOWN = 'Unknown'
const SERVICE_ENDPOINTS = {
  's3.amazonaws.com': 'S3'
}

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.NodeHttpClient)) {
    shim.logger.debug('Could not find NodeHttpClient, not instrumenting.')
    return false
  }
  if (
    !shim.isFunction(AWS.Service) ||
    !shim.isFunction(AWS.Service.prototype.makeRequest)
  ) {
    shim.logger.debug('Could not find AWS.Service#makeRequest, not instrumenting.')
    return false
  }
  return true
}

function instrument(shim, AWS) {
  shim.wrap(AWS.NodeHttpClient.prototype, 'handleRequest', wrapHandleRequest)
  shim.wrapReturn(AWS.Service.prototype, 'makeRequest', wrapMakeRequest)
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

function wrapMakeRequest(shim, fn, name, request) {
  if (!request) {
    shim.logger.trace('No request object returned from Service#makeRequest')
    return
  }

  request.on('complete', function onAwsRequestComplete() {
    const httpRequest = request.httpRequest && request.httpRequest.stream
    const segment = shim.getSegment(httpRequest)
    if (!httpRequest || !segment) {
      shim.logger.trace('No segment found for request, not extracting information.')
      return
    }

    const {service, operation} = request
    const endpoint = service && service.config && service.config.endpoint
    const requestId = request.response && request.response.requestId

    segment.parameters['aws.operation'] = operation || UNKNOWN
    segment.parameters['aws.service'] = SERVICE_ENDPOINTS[endpoint] || endpoint
    segment.parameters['aws.requestId'] = requestId || UNKNOWN
  })
}

module.exports = {
  name: 'core',
  type: 'generic',
  validate,
  instrument
}
