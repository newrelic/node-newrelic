/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const UNKNOWN = 'Unknown'

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.NodeHttpClient)) {
    shim.logger.debug('Could not find NodeHttpClient, not instrumenting.')
    return false
  }
  if (!shim.isFunction(AWS.Service) || !shim.isFunction(AWS.Service.prototype.makeRequest)) {
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

  const service = getServiceName(this)
  const region = this?.config?.region
  request.on('complete', function onAwsRequestComplete() {
    const httpRequest = request.httpRequest && request.httpRequest.stream
    const segment = shim.getSegment(httpRequest)
    if (!httpRequest || !segment) {
      shim.logger.trace('No segment found for request, not extracting information.')
      return
    }

    const requestRegion = request?.httpRequest?.region
    const requestId = request?.response?.requestId

    segment.addAttribute('aws.operation', request.operation || UNKNOWN)
    segment.addAttribute('aws.requestId', requestId || UNKNOWN)
    segment.addAttribute('aws.service', service || UNKNOWN)
    segment.addAttribute('aws.region', requestRegion || region || UNKNOWN)
  })

  shim.wrap(request, 'promise', function wrapPromiseFunc(shim, original) {
    const activeSegment = shim.getActiveSegment()

    return function wrappedPromiseFunc() {
      if (!activeSegment) {
        return original.apply(this, arguments)
      }

      const promise = shim.applySegment(original, activeSegment, false, this, arguments)

      return shim.bindPromise(promise, activeSegment)
    }
  })
}

function getServiceName(service) {
  if (service.api && (service.api.abbreviation || service.api.serviceId)) {
    return service.api.abbreviation || service.api.serviceId
  }

  // In theory, getting the `constructor.prototype` should be redundant with
  // checking `service`. However, the aws-sdk dynamically generates classes and
  // doing this deep check was the recommended method by the maintainers.
  const constructor = service.constructor
  const api = constructor && constructor.prototype && constructor.prototype.api
  if (api) {
    return api.abbreviation || api.serviceId
  }
  return null
}

module.exports = {
  name: 'core',
  type: 'generic',
  validate,
  instrument
}
