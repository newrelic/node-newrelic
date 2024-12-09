/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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

    if (isGatewayV1Event(event) === true || isAlbEvent(event) === true) {
      this.url.path = event.path
      this.method = event.httpMethod
    } else if (isGatewayV2Event(event) === true) {
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
    return event.queryStringParameters
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
  return isGatewayV1Event(event) || isGatewayV2Event(event) || isAlbEvent(event)
}

/**
 * Iterates over the minimum signature properties of an event received by this Lambda function
 * to determine if this request is triggered from a proxy (API Gateway V1, V2, ALB) or some other service.
 * If API Gateway, we need to determine which version: V1 and V2 have a lot of overlap, but some signature
 * differences for which we can test.
 *
 * The test is designed to look only at signature properties used by each version, and returns true with the first
 * top-level match. Each test array has only four elements, and each invocation should incur
 * only five comparisons: one match for its matching type, and four comparisons for the non-matching type.
 *
 * API Gateway v2 HTTP: top-level 'rawPath', 'rawQueryString', 'routeKey'. Possibly 'cookies'
 * API Gateway v1 HTTP: top-level 'httpMethod', 'resource'. Possibly 'multiValueHeaders', 'multiValueQueryStringParameters'
 * API Gateway v1 REST same as HTTP, but without top-level `version`
 * ALB: very similar to API Gateway v1, but requestContext contains an elb property
 *
 * In tests, this set of required API Gateway v1 properties has consistently been delivered in event payloads.
 * Similar tests with API Gateway V2 shows that the cookies property is *only* defined if cookies are present.
 * If `cookies` is present as a top-level property, the event is surely triggered by API Gateway V2. Its absence,
 * though, is *not* a certain indicator of v1. As such, it's the last property considered in our test.
 *
 * @param {object} targetEvent The event to inspect.
 * @param {Array} searchFor An array of keys unique to this proxy type
 * @returns {boolean} Whether this event has matches for the keys we're checking
 */
function eventHasRequiredKeys(targetEvent, searchFor) {
  const keys = Object.keys(targetEvent)
  for (const el of searchFor) {
    if (keys.indexOf(el) > -1) {
      return true
    }
  }
  return false
}

// See https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
const requiredHttpApiV1Keys = [
  'httpMethod',
  'path',
  'resource',
  'multiValueHeaders',
  'multiValueQueryStringParameters'
]

// See https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
function isGatewayV1Event(event) {
  if (event?.requestContext === undefined || event?.requestContext?.elb !== undefined) {
    return false
  }
  const hasKeys = eventHasRequiredKeys(event, requiredHttpApiV1Keys)
  if (hasKeys && event?.version === '1.0') {
    return true
  }
  // Rest API doesn't have version, but we can check on the key matching:
  return hasKeys
}

// See https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
const requiredHttpApiV2Keys = ['rawPath', 'rawQueryString', 'routeKey', 'cookies']

function isGatewayV2Event(event) {
  if (event?.requestContext === undefined || event?.requestContext?.elb !== undefined) {
    return false
  }
  return eventHasRequiredKeys(event, requiredHttpApiV2Keys) && event?.version === '2.0'
}

/**
 * ALB can act as a proxy for Lambda. Properties have commonalities with API GateWay v1, though ALB-triggered events
 * consistently carry an ARN at requestContext.elb. See
 * https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#receive-event-from-load-balancer
 * and https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html
 *
 * If we check for that property, we can accept variation in other properties.
 * @param {object} event The event property supplied to the Lambda handler
 * @returns {boolean} Whether or not the event was triggered by ALB
 */
function isAlbEvent(event) {
  return event?.requestContext?.elb !== undefined
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
  isGatewayV1Event,
  isGatewayV2Event,
  isAlbEvent
}
