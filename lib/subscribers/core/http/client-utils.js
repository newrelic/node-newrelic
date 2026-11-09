/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { URL } = require('node:url')

const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 80
const DEFAULT_SSL_PORT = 443

/**
 * Determines the default port: 80 if the protocol is `http:`, otherwise 443.
 * The protocol is the one in the options, or the default protocol of the
 * module that made the request when the options do not specify one.
 *
 * @param {object} opts The HTTP request options.
 * @param {string} defaultProtocol The protocol of the module that made the request.
 * @returns {number} The default port.
 */
function getDefaultPort(opts, defaultProtocol) {
  const protocol = opts.protocol || defaultProtocol
  return protocol === 'http:' ? DEFAULT_HTTP_PORT : DEFAULT_SSL_PORT
}

/**
 * Determines the port from the HTTP request options. A string port is
 * converted to a number, as `http` does: e.g. `'8080'` is 8080. A string that
 * is not a number, e.g. `'abc'`, is returned as is, rather than as `NaN`, so
 * it is still recorded as the request's port when `http` rejects it.
 *
 * @param {object} opts The HTTP request options.
 * @param {number} defaultPort The port to use when the options do not specify one.
 * @returns {number|string} The port.
 */
function getPort(opts, defaultPort) {
  const port = opts.port || opts.defaultPort
  if (!port) {
    return defaultPort
  }

  const portNumber = Number(port)
  return Number.isNaN(portNumber) ? port : portNumber
}

/**
 * Determines the hostname from the HTTP request options.
 *
 * @param {object} opts The HTTP request options.
 * @returns {string} The hostname, or `localhost` when the options do not specify one.
 */
function getDefaultHostName(opts) {
  return opts.hostname || opts.host || DEFAULT_HOST
}

/**
 * Extracts the host, hostname, and port from the HTTP request options.
 *
 * @param {object} opts The HTTP request options.
 * @param {string} [defaultProtocol] The protocol of the module that made the
 * request, `http:` or `https:`, used when the options do not specify one.
 * @returns {object} The `{ host, hostname, port }` of the request.
 */
function extractHostPort(opts, defaultProtocol = 'http:') {
  const defaultPort = getDefaultPort(opts, defaultProtocol)
  const hostname = getDefaultHostName(opts)
  const port = getPort(opts, defaultPort)
  let host = hostname
  if (port && port !== defaultPort) {
    host += `:${port}`
  }
  return { host, hostname, port }
}

/**
 * Extracts the host, hostname, and port from the HTTP request options when
 * using a proxy.
 *
 * @param {object} opts The HTTP request options.
 * @returns {object|null} The `{ host, hostname, port }` of the request if it is
 * a proxy request, otherwise `null`.
 */
function extractHostPortViaProxy(opts) {
  const pathname = opts.pathname || opts.path

  if (pathname && (pathname.startsWith('https://') || pathname.startsWith('http://'))) {
    const url = new URL(pathname)
    return {
      host: url.host,
      hostname: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? DEFAULT_SSL_PORT : DEFAULT_HTTP_PORT)
    }
  }

  return null
}

/**
 * Converts a URL into HTTP request options. Taken from the Node code base,
 * internal/url.js.
 *
 * @param {URL} _url The URL to convert.
 * @returns {object} The HTTP request options.
 */
function urlToOptions(_url) {
  const options = {
    protocol: _url.protocol,
    hostname:
      typeof _url.hostname === 'string' && _url.hostname.startsWith('[')
        ? _url.hostname.slice(1, -1)
        : _url.hostname,
    hash: _url.hash,
    search: _url.search,
    pathname: _url.pathname,
    path: `${_url.pathname || ''}${_url.search || ''}`,
    href: _url.href
  }
  if (_url.port !== '') {
    options.port = Number(_url.port)
  }
  if (_url.username || _url.password) {
    options.auth = `${_url.username}:${_url.password}`
  }
  return options
}

/**
 * Normalizes the varying `http.request` and `http.get` signatures into an
 * options object and callback.
 *
 * @param {*} input The first argument of `http.request` or `http.get`.
 * @param {*} options The request options, or the callback.
 * @param {Function} cb The callback, if present.
 * @returns {Array} The `[options, cb]` of the request.
 */
function parseRequest(input, options, cb) {
  // If the first argument is a URL, merge it into the options object.
  // This code is copied from Node internals.
  if (typeof input === 'string') {
    const urlStr = input
    input = urlToOptions(new URL(urlStr))
  } else if (input.constructor && input.constructor.name === 'URL') {
    input = urlToOptions(input)
  } else {
    cb = options
    options = input
    input = null
  }

  if (typeof options === 'function') {
    cb = options
    options = input || {}
  } else {
    options = Object.assign(input || {}, options)
  }

  return [options, cb]
}

/**
 * Assigns new headers for the outgoing request.
 *
 * @param {object|Array} currentHeaders The headers from the request options.
 * @param {object} outboundHeaders The headers to add to the outgoing request.
 * @returns {object|Array} The merged headers, in the same format as `currentHeaders`.
 */
function assignOutgoingHeaders(currentHeaders, outboundHeaders) {
  let headers

  if (Array.isArray(currentHeaders)) {
    headers = currentHeaders.slice()
    Array.prototype.push.apply(
      headers,
      Object.keys(outboundHeaders).map(function getHeaderTuples(key) {
        return [key, outboundHeaders[key]]
      })
    )
  } else {
    headers = Object.assign(Object.create(null), currentHeaders, outboundHeaders)
  }

  return headers
}

module.exports = {
  assignOutgoingHeaders,
  extractHostPort,
  extractHostPortViaProxy,
  parseRequest
}
