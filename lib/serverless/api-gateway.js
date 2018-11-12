'use strict'

/**
 * This class captures data needed to construct a web transaction from
 * a API Gateway Lambda proxy request. This is to be used with the setWebRequest
 * method.
 */
class LambdaProxyWebRequest {
  constructor(event) {
    this.headers = event.headers
    this.url = {
      'path': event.path,
      'port': event.headers['X-Forwarded-Port'],
      'requestParameters': event.queryStringParameters
    }
    this.method = event.httpMethod
    this.transportType = event.headers['X-Forwarded-Proto']
  }
}

/**
 * This class captures data necessary to create a web transaction from the lambda's web
 * response to API Gateway when used with API Gateway Lambda proxy. This is to be used
 * with the setWebResponse method.
 */
class LambdaProxyWebResponse {
  constructor(lambdaResponse) {
    this.headers = lambdaResponse.headers
    this.statusCode = lambdaResponse.statusCode
  }
}

/**
 * Determines if Lambda event appears to be a valid Lambda Proxy event.
 *
 * @param {Object} event The event to inspect.
 *
 * @returns {boolean} Whether the given object contains fields necessary
 *                    to create a web transaction.
 */
function isLambdaProxyEvent(event) {
  return !!(event.path && event.headers && event.httpMethod)
}

/**
 * Determines if Lambda event appears to be a valid Lambda Proxy response.
 *
 * @param {Object} event The response to inspect.
 *
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
  isValidLambdaProxyResponse
}
