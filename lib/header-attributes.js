'use strict'

const DESTS = require('./config/attribute-filter').DESTINATIONS

const COLLECTED_REQUEST_HEADERS = [
  'accept',
  'content-length',
  'content-type',
  'referer',
  'user-agent',
  'host'
]

const HEADER_ATTR_NAMES = {
  'accept':                       'accept',
  'accept-charset':               'acceptCharset',
  'accept-encoding':              'acceptEncoding',
  'access-control-allow-headers': 'accessControlAllowHeaders',
  'access-control-allow-methods': 'accessControlAllowMethods',
  'access-control-allow-origin':  'accessControlAllowOrigin',
  'age':                          'age',
  'allow':                        'allow',
  'authorization':                'authorization',
  'cache-control':                'cacheControl',
  'connection':                   'connection',
  'cookie':                       'cookie',
  'content-encoding':             'contentEncoding',
  'content-length':               'contentLength',
  'content-type':                 'contentType',
  'date':                         'date',
  'etag':                         'eTag',
  'expect':                       'expect',
  'expires':                      'expires',
  'forwarded':                    'forwarded',
  'host':                         'host',
  'if-match':                     'ifMatch',
  'if-modified-since':            'ifModifiedSince',
  'last-modified':                'lastModified',
  'location':                     'location',
  'newrelic':                     'newrelic',
  'origin':                       'origin',
  'proxy-authorization':          'proxyAuthorization',
  'referer':                      'referer',
  'refresh':                      'refresh',
  'server':                       'server',
  'set-cookie':                   'setCookie',
  'transfer-encoding':            'transferEncoding',
  'user-agent':                   'userAgent',
  'upgrade':                      'upgrade',
  'vary':                         'vary',
  'x-correlation-id':             'xCorrelationId',
  'x-csrf-token':                 'xCsrfToken',
  'x-forwarded-for':              'xForwardedFor',
  'x-http-method-override':       'xHttpMethodOverride',
  'x-newrelic-app-data':          'xNewrelicAppData',
  'x-newrelic-id':                'xNewrelicId',
  'x-newrelic-synthetics':        'xNewrelicSynthetics',
  'x-newrelic-transaction':       'xNewrelicTransaction',
  'x-powered-by':                 'xPoweredBy',
  'x-queue-start':                'xQueueStart',
  'x-request-id':                 'xRequestId',
  'x-request-start':              'xRequestStart',
  'x-requested-with':             'xRequestedWith'
}

const REQUEST_HEADER_PREFIX = 'request.headers.'
const RESPONSE_HEADER_PREFIX = 'response.headers.'
const REQUEST_HEADER_NAMES = Object.create(null)
const RESPONSE_HEADER_NAMES = Object.create(null)

_setHeaderAttrNames(REQUEST_HEADER_NAMES, REQUEST_HEADER_PREFIX)
_setHeaderAttrNames(RESPONSE_HEADER_NAMES, RESPONSE_HEADER_PREFIX)

function _setHeaderAttrNames(dest, prefix) {
  Object.keys(HEADER_ATTR_NAMES).forEach(function forEachHeader(h) {
    dest[h] = prefix + HEADER_ATTR_NAMES[h]
  })
}

function _headerToCamelCase(header) {
  if (header.length === 0) {
    return ''
  }

  if (header.length === 1) {
    return header.toLowerCase()
  }

  const newHeader = header.charAt(0).toLowerCase() + header.slice(1)

  // Converts headers in the form 'header-name' to be in the form 'headerName'
  return newHeader.replace(/[\W_]+(\w)/g, function capitalize(m, $1) {
    return $1.toUpperCase()
  })
}

function _collectHeaders(headers, nameMap, prefix, transaction) {
  if (!headers) {
    return
  }

  if (!transaction.agent.config.allow_all_headers) {
    headers = Object.keys(headers).reduce((collection, key) => {
      collection[key.toLowerCase()] = headers[key]
      return collection
    }, {})
  }

  var headerKeys = !transaction.agent.config.allow_all_headers
    ? COLLECTED_REQUEST_HEADERS
    : Object.keys(headers)

  for (var i = 0; i < headerKeys.length; i++) {
    var headerKey = headerKeys[i]
    var header = headers[headerKey]
    if (header !== undefined) {
      // If any more processing of the headers is required consider refactoring this.
      if (headerKey === 'referer' && typeof header === 'string') {
        var queryParamIndex = header.indexOf('?')
        if (queryParamIndex !== -1) {
          header = header.substring(0, queryParamIndex)
        }
      }

      var attributeName = nameMap[headerKey] || prefix + _headerToCamelCase(headerKey)
      transaction.trace.attributes.addAttribute(
        DESTS.TRANS_COMMON,
        attributeName,
        header
      )
    }
  }
}

/**
 * Adds request headers as request.headers.* attributes to the given transaction.
 * @param {Object.<string, string>} headers - Request headers to add attributes for.
 * @param {Transaction} transaction - Transaction to add header attributes to.
 */
function collectRequestHeaders(headers, transaction) {
  _collectHeaders(headers, REQUEST_HEADER_NAMES, REQUEST_HEADER_PREFIX, transaction)
}

/**
 * Adds response headers as response.headers.* attributes to the given transaction.
 * @param {Object.<string, string>} headers - Response headers to add attributes for.
 * @param {Transaction} transaction - Transaction to add header attributes to.
 */
function collectResponseHeaders(headers, transaction) {
  _collectHeaders(headers, RESPONSE_HEADER_NAMES, RESPONSE_HEADER_PREFIX, transaction)
}

module.exports = {
  collectRequestHeaders,
  collectResponseHeaders
}
