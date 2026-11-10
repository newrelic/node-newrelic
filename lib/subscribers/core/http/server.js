/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('../base')
const { wrapMethod } = require('#agentlib/subscribers/wrap-method.js')
const Transaction = require('#agentlib/transaction/index.js')
const recordWeb = require('#agentlib/metrics/recorders/http.js')
const synthetics = require('#agentlib/synthetics.js')
const symbols = require('#agentlib/symbols.js')
const urltils = require('#agentlib/util/urltils.js')
const NAMES = require('#agentlib/metrics/names.js')

const SERVER_ON_REQUEST = 'Server.onrequest'
const symResHeaders = Symbol('nr.res.headers')

/**
 * Instruments the server half of the `http`/`https` core modules: wraps
 * `createServer`, starts a transaction and base segment on the `'request'`
 * event, and ends that segment (plus finalizes the transaction's web data)
 * when the response finishes.
 */
class HttpServerSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger, packageName = 'http' }) {
    super({
      agent,
      logger,
      prefix: 'server',
      packageName,
      instrumentedMethods: [SERVER_ON_REQUEST]
    })

    // this subscriber creates transactions, must set this flag otherwise handler won't be called
    this.requireActiveTx = false
  }

  get transport() {
    return 'HTTP'
  }

  /**
   * Creates the transaction and base segment for an inbound request.
   * If a transaction is already active, this still processes the request,
   * but against the existing transaction rather than creating a nested one.
   *
   * @param {object} data Event data published to the `start` event.
   * @param {http.IncomingMessage} data.request The inbound request.
   * @param {http.ServerResponse} data.response The outbound response.
   * @param {number|null} data.port The port the server is listening on.
   * @param {object} ctx The current async context.
   * @returns {object} The context entered into the new base segment, or the
   * original context when the agent cannot collect data.
   */
  handler(data, ctx) {
    // Same guard `tracer.transactionProxy` had. The wrap stays in place when the
    // agent can't send data (stopped, disconnected, or errored, e.g. an invalid
    // license key), so don't build a transaction that can never be reported.
    if (!this.agent.canCollectData()) {
      return ctx
    }

    const { request, response, port } = data

    if (ctx.transaction) {
      this.logger.warn(
        {
          transaction: { id: ctx.transaction.id, name: ctx.transaction.getName() },
          segment: ctx.segment?.name
        },
        'Active transaction when creating non-nested transaction'
      )
      this.agent.recordSupportability('Nodejs/Transactions/Nested')
      return this.#setupTransaction({ transaction: ctx.transaction, request, response, port, ctx })
    }

    const transaction = new Transaction(this.agent)
    const txCtx = ctx.enterTransaction(transaction)

    // Typically we only call `runInContext` for instrumented functions,
    // however `#setupTransaction` (specifically `initializeWeb`, via
    // `header-attributes.js`) reads the "current" segment off the tracer
    // rather than taking one as a parameter, so `txCtx` needs to actually be
    // the active async-local-storage context while it runs -- `channel` only
    // applies whatever context `handler` *returns* once this call is done.
    return this.agent.tracer.runInContext({
      handler: this.#setupTransaction.bind(this, { transaction, request, response, port, ctx: txCtx }),
      context: txCtx,
      thisArg: this,
      args: []
    })
  }

  /**
   * Finishes setting up the transaction and base segment started by
   * {@link #handler} as a web transaction, with `ctx` already the active async context
   *
   * @param {object} params Function parameters.
   * @param {Transaction} params.transaction The transaction to process this
   * request against -- newly created, or a pre-existing one in the nested
   * case.
   * @param {http.IncomingMessage} params.request The inbound request.
   * @param {http.ServerResponse} params.response The outbound response.
   * @param {number|null} params.port The port the server is listening on.
   * @param {object} params.ctx The active async context, entered into
   * `transaction`.
   * @returns {object} The context entered into the new base segment -- what
   * {@link #handler} returns, and so what the inbound request is ultimately
   * dispatched to its listeners under.
   */
  #setupTransaction({ transaction, request, response, port, ctx }) {
    transaction.nameState.setPrefix(NAMES.NODEJS.PREFIX)
    transaction.nameState.setDelimiter(NAMES.ACTION_DELIMITER)
    if (request.method != null) {
      transaction.nameState.setVerb(request.method)
    }

    const newCtx = this.createSegment({ name: request.url, recorder: recordWeb, ctx })
    transaction.baseSegment = newCtx.segment

    const txInfo = this.#storeTxInfo(transaction, request, response)
    // TODO: Look into if we can safely remove this.
    // Only thing using it is the legacy middleware shim
    if (txInfo) {
      txInfo.segmentStack.push(newCtx.segment)
    }

    const absoluteUrl = this.#resolveAbsoluteUrl(request)

    transaction.initializeWeb({
      absoluteUrl,
      method: request.method,
      port,
      headers: request.headers,
      transport: this.transport
    })

    /* Needed for Connect and Express middleware that monkeypatch request
     * and response via listeners.
     */
    this.agent.tracer.bindEmitter(request, newCtx.segment)
    this.agent.tracer.bindEmitter(response, newCtx.segment)

    const onResponseDone = () => {
      // 'finish' and 'close' can both fire for the same response; remove
      // both listeners so this doesn't run twice.
      response.removeListener('finish', onResponseDone)
      response.removeListener('close', onResponseDone)
      this.#instrumentedFinish(response, transaction)
    }
    response.once('finish', onResponseDone)
    response.once('close', onResponseDone)

    return newCtx
  }

  /**
   * Resolves the absolute URL of the inbound request, handling requests
   * made to a proxy URL.
   *
   * @param {http.IncomingMessage} request The inbound request.
   * @returns {string} The resolved absolute URL.
   */
  #resolveAbsoluteUrl(request) {
    if (request?.url.startsWith('http://') || request?.url.startsWith('https://')) {
      return request.url
    }
    return `${this.transport}://${request.headers.host || 'localhost'}${request.url}`
  }

  /**
   * Stores the transaction info relied upon by web framework instrumentation
   * on both the request and response.
   *
   * @param {Transaction} transaction The active transaction.
   * @param {http.IncomingMessage} request The inbound request.
   * @param {http.ServerResponse} response The outbound response.
   * @returns {object|undefined} The stored transaction info, or `undefined`
   * when `request`/`response` are missing.
   */
  #storeTxInfo(transaction, request, response) {
    if (!request || !response) {
      this.logger.debug('Missing request or response object! Not storing transaction info.')
      return
    }

    const txInfo = {
      transaction,
      segmentStack: [],
      errorHandled: false,
      error: null
    }
    request[symbols.transactionInfo] = response[symbols.transactionInfo] = txInfo

    this.logger.trace('Stored transaction %s information on request and response', transaction.id)

    return txInfo
  }

  /**
   * Adds `http.statusCode`/`http.statusText` to the transaction trace and
   * span, and assigns the response headers to the transaction, once the
   * response has finished or closed.
   *
   * @param {http.ServerResponse} response The outbound response.
   * @param {Transaction} transaction The active transaction.
   */
  #instrumentedFinish(response, transaction) {
    transaction.finalizeWeb({
      end: true,
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      headers: {
        ...response.getHeaders(),
        ...response[symResHeaders]
      }
    })
  }

  /**
   * Gets the port from the `Server` object.
   *
   * @param {object} server The `http`/`https` server.
   * @returns {number|null} The parsed port.
   */
  #parsePort(server) {
    let serverPort = null
    if (server.address instanceof Function) {
      const address = server.address()
      if (address) {
        serverPort = address.port
      }
    }
    return serverPort
  }

  instrument(http) {
    if (process.env.FUNCTIONS_WORKER_RUNTIME) {
      this.logger.debug('In azure functions environment, disabling core http instrumentation in favor of @azure/functions')
      return
    }

    this.#wrapCreateServer(http)

    if (http.Server?.prototype) {
      this.#wrapEmit(http.Server.prototype)
    }

    // `https` has no `ServerResponse`/`IncomingMessage` of its own -- requests
    // received over TLS are still served with `http.ServerResponse` instances,
    // which are wrapped once via the `http` subscriber.
    if (http.ServerResponse?.prototype) {
      this.#wrapResponseEnd(http.ServerResponse.prototype)
      this.#wrapWriteHead(http.ServerResponse.prototype)
    }
  }

  /**
   * Assigns a Dispatcher when `createServer` is called.
   * This is sent up on connect in the `environment` collection.
   * @todo Look into removing this as this is only working
   * based on timing of our connection cycle and applications
   * calling `http.createServer` during that async cycle
   *
   * @param {http} http export
   */
  #wrapCreateServer(http) {
    const agent = this.agent
    wrapMethod({
      module: http,
      methodName: 'createServer',
      logger: this.logger,
      wrapper: function wrapCreateServer(createServer) {
        return function setDispatcher(requestListener) {
          agent.environment.setDispatcher('http')
          return createServer.apply(this, arguments)
        }
      }
    })
  }

  /**
   * Wraps `Server.prototype.emit` but only runs
   * the emit in traceSync is the event name is `request`
   * This takes care of creating the transaction and binding event emitters
   * to the request/response emitters
   *
   * @param {http.Server} serverProto prototype of http server
   */
  #wrapEmit(serverProto) {
    const self = this
    const [channel] = this.channels

    wrapMethod({
      module: serverProto,
      methodName: 'emit',
      logger: this.logger,
      wrapper: function wrapEmit(emit) {
        return function wrappedEmit(evnt, request, response) {
          if (evnt !== 'request') {
            return emit.apply(this, arguments)
          }

          const data = {
            request,
            response,
            port: self.#parsePort(this)
          }
          return channel.traceSync(emit, data, this, ...arguments)
        }
      }
    })
  }

  /**
   * Wraps `http.ServerResponse.prototype.end`
   *  1. It will log unhandled errors that occurred during the request
   *  2. End all segments in the stack(this should be removed in future as it is only used by the legacy middleware shim)
   *  3. End the current segment
   *  4. Freeze the transaction name that was built up during the request
   *
   *  @param {http.ServerResponse} proto of ServerResponse
   */
  #wrapResponseEnd(proto) {
    const agent = this.agent

    wrapMethod({
      module: proto,
      methodName: 'end',
      logger: this.logger,
      wrapper: function wrapResEnd(end) {
        return function wrappedResEnd() {
          const txInfo = this && this[symbols.transactionInfo]
          if (!txInfo) {
            return end.apply(this, arguments)
          }

          if (!txInfo.transaction.isActive()) {
            return end.apply(this, arguments)
          }

          // If an error happened, and it was unhandled by the user's app, add it to the aggregator.
          if (
            txInfo.error &&
            (!txInfo.errorHandled || urltils.isError(agent.config, this.statusCode))
          ) {
            agent.errors.add(txInfo.transaction, txInfo.error)
          }

          // TODO: Look into if we can safely remove this.
          // Only thing using it is the legacy middleware shim
          for (let i = txInfo.segmentStack.length - 1; i >= 0; --i) {
            txInfo.segmentStack[i].end()
          }
          const segment = agent.tracer.getSegment()
          if (segment) {
            segment.end()
          }

          // Freeze the name state to prevent further changes.
          txInfo.transaction.nameState.freeze()

          return end.apply(this, arguments)
        }
      }
    })
  }

  /**
   * Wraps `http.ServerResponse.prototype.writeHead`
   * It will add the NR synthetics headers to the response headers of a given request
   * if there is an active transaction
   *
   *  @param {http.ServerResponse} proto of ServerResponse
   */
  #wrapWriteHead(proto) {
    const agent = this.agent

    wrapMethod({
      module: proto,
      methodName: 'writeHead',
      logger: this.logger,
      wrapper: function wrapWriteHead(writeHead) {
        return function wrappedWriteHead(...args) {
          const transaction = agent.tracer.getTransaction()
          if (!transaction) {
            return writeHead.apply(this, args)
          }

          // This is to handle the case where `res.writeHead(int, obj)` was
          // used. In that case, modern Node.js directly serializes the
          // headers object to the socket if a prior `res.setHeader` has
          // not been invoked. So we must capture that object and cache it
          // ourselves.
          //
          // We already mutate the response object with new fields in the
          // rest of this instrumentation, so what's another one?
          const headers = args.at(-1)
          if (Array.isArray(headers) === true) {
            const mapped = Object.create(null)
            for (let i = 0; i < headers.length; i += 2) {
              mapped[headers[i].toLowerCase()] = headers[i + 1]
            }
            this[symResHeaders] = mapped
          } else if (Object.prototype.toString.call(headers) === '[object Object]') {
            const mapped = Object.create(null)
            for (const key of headers) {
              mapped[key.toLowerCase()] = headers[key]
             }
            this[symResHeaders] = headers
          }
          synthetics.assignHeadersToResponse(this, transaction)

          return writeHead.apply(this, args)
        }
      }
    })
  }
}

module.exports = HttpServerSubscriber
