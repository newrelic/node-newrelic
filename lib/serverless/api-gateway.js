/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'api-gateway' })

/**
 * This class captures data needed to construct a web transaction from
 * an API Gateway Lambda proxy request. This is to be used with the setWebRequest
 * method.
 */
class LambdaProxyWebRequest {
  constructor(event) {
    const lowerCaseHeaders = normalizeHeaders(event, true)

    this.headers = normalizeHeaders(event)
    this.url = {
      path: '',
      port: lowerCaseHeaders['x-forwarded-port'],
      requestParameters: normalizeQueryStringParameters(event)
    }
    this.method = ''

    if (isGatewayV1ProxyEvent(event) === true) {
      logger.trace('Web proxy event is API Gateway v1 or ALB')
      this.url.path = event.path
      this.method = event.httpMethod
    } else if (isGatewayV2ProxyEvent(event) === true) {
      logger.trace('Web proxy event is API Gateway v2')
      this.url.path = event.requestContext.http.path
      this.method = event.requestContext.http.method
    }

    this.transportType = lowerCaseHeaders['x-forwarded-proto']
  }
}

/**
 * This class captures data necessary to create a web transaction from the lambda's web
 * response to API Gateway when used with API Gateway Lambda proxy. This is to be used
 * with the setWebResponse method.
 */
class LambdaProxyWebResponse {
  constructor(lambdaResponse) {
    this.headers = normalizeHeaders(lambdaResponse)
    this.statusCode = lambdaResponse.statusCode
  }
}

/**
 * normalizes query string parameters either from multi value query string parameters or normal query string parameters to a
 * key map with comma separated strings
 *
 * @param {object} event The event with query string to normalize
 * @returns {Object<string, string>} The normalized query string map
 */
function normalizeQueryStringParameters(event) {
  if (
    !event.multiValueQueryStringParameters ||
    Object.keys(event.multiValueQueryStringParameters).length === 0
  ) {
    return event.queryStringParameters ?? {}
  }
  return Object.fromEntries(
    Object.entries(event.multiValueQueryStringParameters).map(([param, value]) => {
      if (Array.isArray(value)) {
        return [param, value.join(',')]
      }
      return [param, value]
    })
  )
}

/**
 * Normalizes both request and response headers,
 * either from Multi Value headers or "normal" headers to a
 * lowercase key map with comma separated string
 *
 * @param {object} event The event with headers to normalize
 * @param {boolean} lowerCaseKey Whether to lowercase the header names or not
 * @returns {Object<string, string>} The normalized headers map
 */
function normalizeHeaders(event, lowerCaseKey = false) {
  const headers = event.multiValueHeaders ?? event.headers

  if (!headers) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(headers).map(([headerKey, headerValue]) => {
      const newKey = lowerCaseKey ? headerKey.toLowerCase() : headerKey

      if (Array.isArray(headerValue)) {
        return [newKey, headerValue.join(',')]
      }
      return [newKey, headerValue]
    })
  )
}

/**
 * Determines if Lambda event appears to be a valid Lambda Proxy event.
 * There are multiple types of events possible. They are described at
 * https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html#services-apigateway-apitypes.
 * Each type of event has its own event payload structure; some types have
 * multiple versions of the payload structure.
 *
 * @param {object} event The event to inspect.
 * @returns {boolean} Whether the given object contains fields necessary
 *                    to create a web transaction.
 */
function isLambdaProxyEvent(event) {
  return isGatewayV1ProxyEvent(event) || isGatewayV2ProxyEvent(event)
}

// See https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
// See https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
function isGatewayV1ProxyEvent(event) {
  return !!(event.httpMethod && event.path && (event.headers ?? event.multiValueHeaders))
}

// See https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
function isGatewayV2ProxyEvent(event) {
  return !!(event.requestContext?.http?.method && event.requestContext?.http?.path && event.headers)
}

/**
 * Determines if Lambda event appears to be a valid Lambda Proxy response.
 *
 * @param {object} response The response to inspect.
 * @returns {boolean} Whether the given object contains fields necessary
 *                    to create a web transaction.
 */
function isValidLambdaProxyResponse(response) {
  return !!(response && response.statusCode)
}

module.exports = {
  LambdaProxyWebRequest,
  LambdaProxyWebResponse,
  isLambdaProxyEvent,
  isValidLambdaProxyResponse,
  isGatewayV1ProxyEvent,
  isGatewayV2ProxyEvent
}
