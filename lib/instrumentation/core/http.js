/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shimmer = require('../../shimmer')
const logger = require('../../logger').child({ component: 'http' })
const instrumentOutbound = require('./http-outbound')
const symbols = require('../../symbols')

// For outbound requests this instrumentation functions by wrapping
// `http.request`/`http.get` and `http.Agent#createConnection`. Server-side
// instrumentation (createServer, the `request` event, and ServerResponse)
// has moved to the subscriber-based `lib/subscribers/core/http.js` and
// `lib/subscribers/core/https.js`.

// Taken from the Node code base, internal/url.js
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
 *  http.request and http.get signatures vary. This function
 *  will parse the options and callback
 *
 *  @param {*} input first arg of http.request and http.get
 *  @param {*} options request opts of callback
 *  @param {Function} cb if present it is the callback
 *  @returns {Array} [options, cb]
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

function wrapRequest(agent, request) {
  return function wrappedRequest(input, options, cb) {
    ;[options, cb] = parseRequest(input, options, cb)
    const reqArgs = [options, cb]

    // Don't pollute metrics and calls with NR connections
    const internalOnly = options && options[symbols.offTheRecord]
    if (internalOnly) {
      delete options[symbols.offTheRecord]
    }

    // If this is not a request we're recording, exit early.
    const transaction = agent.tracer.getTransaction()
    if (!transaction || internalOnly) {
      if (!internalOnly && logger.traceEnabled()) {
        logger.trace(
          'No transaction, not recording external to %s:%s',
          options?.hostname || options?.host,
          options?.port
        )
      }
      return request.apply(this, reqArgs)
    }

    const args = agent.tracer.slice(reqArgs)
    const context = this

    return instrumentOutbound(agent, options, function makeRequest(opts) {
      args[0] = opts
      return request.apply(context, args)
    })
  }
}

module.exports = function initialize(agent, http, moduleName) {
  if (!http) {
    logger.debug('Did not get http module, not instrumenting!')
    return false
  }

  if (process.env.FUNCTIONS_WORKER_RUNTIME) {
    logger.debug('In azure functions environment, disabling core http instrumentation in favor of @azure/functions')
    return false
  }

  const agentProto = http && http.Agent && http.Agent.prototype

  shimmer.wrapMethod(http, 'http', 'request', wrapRequest.bind(null, agent))

  shimmer.wrapMethod(http, 'http', 'get', wrapRequest.bind(null, agent))

  shimmer.wrapMethod(
    agentProto,
    'http.Agent.prototype',
    'createConnection',
    function wrapCreateConnection(original) {
      return function wrappedCreateConnection() {
        const context = agent.tracer.getContext()
        if (!agent.getTransaction()) {
          return original.apply(this, arguments)
        }

        const segment = agent.tracer.createSegment({
          name: 'http.Agent#createConnection',
          parent: context.segment,
          transaction: context.transaction
        })

        const args = agent.tracer.slice(arguments)
        const newContext = context.enterSegment({ segment })
        return agent.tracer.runInContext({ handler: original, context: newContext, full: true, thisArg: this, args })
      }
    }
  )
}
