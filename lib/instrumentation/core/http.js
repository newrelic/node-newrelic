/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shimmer = require('../../shimmer')
const logger = require('../../logger').child({ component: 'http' })
const recordWeb = require('../../metrics/recorders/http')
const instrumentOutbound = require('./http-outbound')
const urltils = require('../../util/urltils')
const synthetics = require('../../synthetics')

const NAMES = require('../../metrics/names')
const symbols = require('../../symbols')

// For incoming requests this instrumentation functions by wrapping
// `http.createServer` and `http.Server#addListener`. The former merely sets the
// agent dispatcher to 'http' and the latter wraps any event handlers bound to
// `request`.
//
// The `request` event listener wrapper creates a transaction proxy which will
// start a new transaction whenever a new request comes in. It also scans the
// headers of the incoming request looking for DT and synthetics headers.

function wrapEmitWithTransaction(agent, emit, isHTTPS) {
  const tracer = agent.tracer
  const transport = isHTTPS ? 'HTTPS' : 'HTTP'
  return tracer.transactionProxy(function wrappedHandler(evnt, request, response) {
    const context = tracer.getContext()
    const transaction = tracer.getTransaction()
    if (!transaction) {
      return emit.apply(this, arguments)
    }

    transaction.nameState.setPrefix(NAMES.NODEJS.PREFIX)
    transaction.nameState.setDelimiter(NAMES.ACTION_DELIMITER)
    if (request.method != null) {
      transaction.nameState.setVerb(request.method)
    }

    // Store the transaction information on the request and response.
    const txInfo = storeTxInfo(transaction, request, response)

    // Create the transaction segment using the request URL for now. Once a
    // better name can be determined this segment will be renamed to that.
    const segment = tracer.createSegment({
      name: request.url,
      recorder: recordWeb,
      parent: context.segment,
      transaction
    })
    segment.start()
    transaction.baseSegment = segment

    if (txInfo) {
      // Seed segment stack to enable parenting logic leveraged by
      // web framework instrumentations.
      txInfo.segmentStack.push(segment)
    }

    let absoluteUrl = null
    // handle a request that is to a proxy url
    if (request?.url.startsWith('http://') || request?.url.startsWith('https://')) {
      absoluteUrl = request.url
    // attempt to construct the full URL with known attributes
    } else {
      absoluteUrl = `${transport}://${request.headers.host || 'localhost'}${request.url}`
    }
    const port = parsePort(this)
    transaction.initializeWeb({ absoluteUrl, method: request.method, port, headers: request.headers, transport })

    /* Needed for Connect and Express middleware that monkeypatch request
     * and response via listeners.
     */
    tracer.bindEmitter(request, segment)
    tracer.bindEmitter(response, segment)

    response.once('finish', instrumentedFinish.bind(response, transaction))
    response.once('close', instrumentedFinish.bind(response, transaction))

    const newContext = context.enterSegment({ segment })
    return tracer.bindFunction(emit, newContext).apply(this, arguments)
  })
}

/**
 * Gets the port from the Server object
 *
 * @param {object} server http(s) server
 * @returns {number|null} parsed port
 */
function parsePort(server) {
  let serverPort = null
  // store the port on which this transaction runs
  if (server.address instanceof Function) {
    const address = server.address()
    if (address) {
      serverPort = address.port
    }
  }
  return serverPort
}

/**
 * Adds instrumentation to response on finish/close.
 * It will add `http.statusCode`, `http.statusText`
 * to the transaction trace and span.
 * It will also assign the response headers to the transaction
 *
 * @param {Transaction} transaction active transaction
 */
function instrumentedFinish(transaction) {
  // Remove listeners so this doesn't get called twice.
  this.removeListener('finish', instrumentedFinish)
  this.removeListener('close', instrumentedFinish)
  transaction.finalizeWeb({ end: true, statusCode: this.statusCode, statusMessage: this.statusMessage, headers: this.getHeaders() })
}

function storeTxInfo(transaction, request, response) {
  if (!request || !response) {
    logger.debug('Missing request or response object! Not storing transaction info.')
    return
  }

  const txInfo = {
    transaction,
    segmentStack: [],
    errorHandled: false,
    error: null
  }
  request[symbols.transactionInfo] = response[symbols.transactionInfo] = txInfo

  logger.trace('Stored transaction %s information on request and response', transaction.id)

  return txInfo
}

function wrapResponseEnd(agent, proto) {
  const tracer = agent.tracer

  // On end, we must freeze the current name state to maintain the route that
  // responded and also end the current segment (otherwise it may become truncated).
  shimmer.wrapMethod(proto, 'Response.prototype', 'end', function wrapResEnd(end) {
    if (typeof end !== 'function') {
      logger.debug('Response#end is not a function?')
      return end
    }

    return function wrappedResEnd() {
      const txInfo = this && this[symbols.transactionInfo]
      if (!txInfo) {
        return end.apply(this, arguments)
      }

      if (!txInfo.transaction.isActive()) {
        logger.trace('wrappedResEnd invoked for ended transaction implying multiple invocations.')
        return end.apply(this, arguments)
      }

      // If an error happened, add it to the aggregator.
      if (
        txInfo.error &&
        (!txInfo.errorHandled || urltils.isError(agent.config, this.statusCode))
      ) {
        agent.errors.add(txInfo.transaction, txInfo.error)
      }

      // End all the segments leading up to and including this one.
      for (let i = txInfo.segmentStack.length - 1; i >= 0; --i) {
        txInfo.segmentStack[i].end()
      }
      const segment = tracer.getSegment()
      if (segment) {
        segment.end()
      }

      // Freeze the name state to prevent further changes.
      txInfo.transaction.nameState.freeze()

      return end.apply(this, arguments)
    }
  })
}

/**
 * Adds synthetics headers to response headers
 * TODO: check if we need this as it was gated with CAT before
 *
 * @param {Agent} agent instance
 * @param {Function} writeHead original writeHead method on response
 */
function wrapWriteHead(agent, writeHead) {
  return function wrappedWriteHead() {
    const transaction = agent.tracer.getTransaction()
    if (!transaction) {
      logger.trace('No transaction - not adding synthetics headers to response')
      return writeHead.apply(this, arguments)
    }

    synthetics.assignHeadersToResponse(this, transaction)

    return writeHead.apply(this, arguments)
  }
}

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

  const IS_HTTPS = moduleName === 'https'

  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function wrapMethod(createServer) {
    return function setDispatcher(requestListener) {
      agent.environment.setDispatcher('http')
      return createServer.apply(this, arguments)
    }
  })

  // It's not a great idea to monkeypatch EventEmitter methods given how hot
  // they are, but this method is simple and works with all versions of node
  // supported by the module.
  shimmer.wrapMethod(
    http.Server && http.Server.prototype,
    'http.Server.prototype',
    'emit',
    function wrapEmit(emit) {
      const txStarter = wrapEmitWithTransaction(agent, emit, IS_HTTPS)
      return function wrappedEmit(evnt) {
        if (evnt === 'request') {
          return txStarter.apply(this, arguments)
        }
        return emit.apply(this, arguments)
      }
    }
  )

  wrapResponseEnd(agent, http.ServerResponse && http.ServerResponse.prototype)

  shimmer.wrapMethod(
    http.ServerResponse && http.ServerResponse.prototype,
    'http.ServerResponse.prototype',
    'writeHead',
    wrapWriteHead.bind(null, agent)
  )

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
        if (typeof args[1] === 'function') {
          args[1] = agent.tracer.bindFunction(args[1], newContext, true)
        }

        return agent.tracer.bindFunction(original, newContext, true).apply(this, args)
      }
    }
  )
}
