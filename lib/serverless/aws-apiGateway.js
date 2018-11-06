'use strict'

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

  get headers() {
    return this._headers
  }

  set headers(value) {
    this._headers = value
  }

  get url() {
    return this._url
  }

  set url(value) {
    this._url = value
  }

  get method() {
    return this._method
  }

  set method(value) {
    this._method = value
  }

  get transportType() {
    return this._transportType
  }

  set transportType(value) {
    this._transportType = value
  }
}

class LambdaProxyWebResponse {
  constructor(lambdaResponse) {
    this.headers = lambdaResponse.headers
    this.statusCode = lambdaResponse.statusCode
  }

  get headers() {
    return this._headers
  }

  set headers(value) {
    this._headers = value
  }

  get statusCode() {
    return this._statusCode
  }

  set statusCode(value) {
    this._statusCode = value
  }
}

function isLambdaProxyEvent(event) {
  if (event.path && event.headers && event.httpMethod) {
    return true
  }

  return false
}

function isValidLambdaProxyResponse(response) {
  if (response && response.statusCode) {
    return true
  }

  return false
}

module.exports = {
  LambdaProxyWebRequest,
  LambdaProxyWebResponse,
  isLambdaProxyEvent,
  isValidLambdaProxyResponse
}
