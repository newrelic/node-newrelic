/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { clm, transactionInfo } = require('#agentlib/symbols.js')
const makeMiddlewareRecorder = require('#agentlib/metrics/recorders/middleware.js')
const { addCLMAttributes } = require('#agentlib/util/code-level-metrics.js')
const symbols = require('#agentlib/symbols.js')

/**
 * Helper to get the name of handler function
 * defaults to `<anonymous>` if unnamed
 *
 * @param {Function} handler function
 * @returns {string} name of handler
 */
function getFunctionName(handler) {
  return handler.name === '' ? '<anonymous>' : handler.name
}

/**
 * Default error handler for determining if error should stored with transaction.
 * Note: Based on previous shim instrumentation only Express, Restify, and Hapi have
 * a different handler.
 * @param {Error} err error passed to done handler
 * @returns {boolean} returns true if error exists
 */
function defaultErrorHandler(err) {
  return err
}

/**
 * The baseline parameters available to the middleware wrapper
 *
 * @typedef {object} WrapperParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} system handling the instrumentation(i.e - Fastify, Expressjs, Hapi, etc)
 * @property {Function} [errorHandler] optional function to determine if error should be recorded
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} system handling the instrumentation(i.e - Fastify, Expressjs, Hapi, etc)
 * @property {string} prefix formatted prefix to name segments/timeslice metrics
 */
class MiddlewareWrapper {
  constructor({ agent, logger, system, errorHandler }) {
    this.agent = agent
    this.logger = logger
    this.system = system
    this.config = agent.config
    this.prefix = `Nodejs/Middleware/${this.system}`
    this.agent.environment.setFramework(system)
    this.isError = errorHandler ?? defaultErrorHandler
  }

  /**
   * Used to wrap all middleware handlers. This checks if it is callback based,
   * or promise based, and propagates context accordingly.
   *
   * @param {object} params to function
   * @param {Function} params.handler the function getting wrapped
   * @param {string} params.prefix value of segment name prefix(only used if not this.prefix)
   * @param {string} params.route route that is serving the handler
   * @param {string} params.segmentName name of segment, only used if not derived from prefix + function name + route
   * @param {number} params.nextIdx index of next handler, defaults to -1
   * @param {boolean} params.isLastInRouter flag to indicate the middleware is the final one in a router layer stack
   * @returns {Function} a wrapped function used to record a segment and assign necessary transaction data
   */
  wrap({ handler, prefix, route, segmentName, nextIdx = -1, isLastInRouter = false }) {
    const self = this
    if (typeof handler !== 'function') {
      this.logger.trace('Handler is not a function, not wrapping.')
      return handler
    }

    if (handler[symbols.original]) {
      this.logger.trace('Handler is already wrapped, not wrapping.')
      return handler
    }

    function wrappedHandler (...args) {
      const ctx = self.agent.tracer.getContext()
      if (ctx?.transaction?.isActive() !== true) {
        self.logger.trace('No active transaction, calling original function')
        return handler.apply(this, args)
      }
      const transaction = ctx?.transaction
      transaction.nameState.setPrefix(self.system)
      const { txInfo, errorWare, request } = self.extractTxInfo(args, route)

      // only append route to nameState if not error middleware(may consider moving this out)
      if (route && !errorWare) {
        transaction.nameState.appendPath(route, request.params)
      }

      const name = self.nameSegment({ handler, prefix, route, errorWare, segmentName })
      const recorder = self.constructRecorder({ handler, transaction, segmentName })
      const parent = ctx?.segment
      const segment = self.agent.tracer.createSegment({
        name,
        parent,
        recorder,
        transaction
      })

      if (!segment) {
        self.logger.trace('Failed to create new segment %s, calling original function', name)
        return handler.apply(this, args)
      }

      self.logger.trace('Created segment %s, parent %s', segment?.name, parent?.name)

      if (self.config.code_level_metrics.enabled === true) {
        handler[clm] = true
        addCLMAttributes(handler, segment)
      }
      const newCtx = ctx.enterSegment({ segment })

      self.wrapDoneHandler({ segment, ctx, args, handler, txInfo, route, nextIdx, isLastInRouter })

      let error
      try {
        const result = self.agent.tracer.runInContext({ handler, context: newCtx, thisArg: this, args, full: true })
        if (result?.then) {
          return result.then(function onThen(val) {
            self.maybeHandleError(txInfo)
            return val
          },
          function onCatch(err) {
            self.maybeHandleError(txInfo, err)
            throw err
          })
        }
        return result
      } catch (err) {
        error = err
        throw err
      } finally {
        self.maybeHandleError(txInfo, error)
      }
    }
    Object.defineProperties(wrappedHandler, {
      name: { value: handler.name },
      length: { value: handler.length },
      [symbols.original]: { value: handler }
    })
    return wrappedHandler
  }

  /**
   * Extracts the transaction info from the IncomingMessage
   * this is assigned in `lib/instrumentation/core/http.js`
   * TODO: remove the reliance on `txInfo` and just store on transaction. This is more work than just changing to storing
   * on tx, it appears context is getting lost in http instrumentation
   *
   * @param {Array} args arguments to middleware function
   * @param {string} route handling middleware
   * @returns {object} { txInfo, request, errorWare }
   */
  extractTxInfo(args, route) {
    let errorWare = false
    let [request] = args
    // 4 args indicates an error handler middleware
    if (args.length === 4) {
      ;[, request] = args
      errorWare = true
      route = null
    }

    // fallback to empty object, this is purely defensive code and will not correlate
    // the error with the http request
    // see: https://github.com/newrelic/node-newrelic/issues/3696
    // request.raw is fastify
    // request.raw.req is hapi
    // request is express/connect
    const txInfo = request?.raw?.[transactionInfo] || request?.raw?.req?.[transactionInfo] || request?.[transactionInfo] || {}
    if (errorWare) {
      txInfo.errorHandled = errorWare
    }
    return { txInfo, request, errorWare }
  }

  /**
   * Wraps the done/next handler if it is a sync middleware handler
   * and propagates that segment context accordingly. It also, handles
   * the error if one is passed to handler.
   *
   * In most web frameworks the `done` function is synchronous aside from the
   * handler `done` function that is async.
   *
   * @param {object} params to function
   * @param {Array} params.args arguments to middleware function
   * @param {TraceSegment} params.segment the segment that was created in the middleware function, used to propagate
   * @param {Context} params.ctx context from the original middleware function
   * @param {Function} params.handler original middleware function, used to check if async
   * @param {object} params.txInfo the context stored on IncomingMessage, this is so old that relying on context from context manage
   * breaks it certain cases, will address in future
   * @param {string} params.route route registered to middleware handler
   * @param {number} params.nextIdx index of done/next handler
   */
  wrapDoneHandler({ args, segment, ctx, handler, txInfo, route, nextIdx }) {
    const self = this
    const doneFn = args.at(nextIdx)
    const isSync = typeof doneFn === 'function' &&
      handler.constructor.name !== 'AsyncFunction'

    if (isSync) {
      function wrappedDone(...doneArgs) {
        const [err] = doneArgs
        if (self.isError(err)) {
          self.maybeHandleError(txInfo, err)
        // route has been completed, pop from path
        // to allow other handlers to name it more accurately
        } else if (route) {
          route = Array.isArray(route) ? route.join(',') : route
          ctx?.transaction?.nameState?.popPath(route)
        }

        segment.touch()
        // binding previous ctx as it should restore once this cb is executed
        return self.agent.tracer.runInContext({ handler: doneFn, context: ctx, thisArg: this, args: doneArgs, full: false })
      }

      Object.defineProperties(wrappedDone, {
        name: { value: doneFn.name },
        length: { value: doneFn.length }
      })

      if (nextIdx === -1) {
        args[args.length - 1] = wrappedDone
      } else {
        args[nextIdx] = wrappedDone
      }
    }
  }

  /**
   * Errors are handled in `lib/instrumentation/core/http.js` when the
   * http response is ended. This is because it has to check if the status
   * code is being ignored via config.
   * This handles assigning error but also marking error as handled if
   * a middleware in the chain succeeds after an error.
   *
   * TODO: remove the reliance on `txInfo` and just store on transaction. This is more work than just changing to storing
   * on tx, it appears context is getting lost in http instrumentation
   * @param {object} txInfo object storing transaction, error, segmentStack(not used in migrated subscribers)
   * @param {Error} err error that occurred
   */
  maybeHandleError(txInfo, err) {
    if (err) {
      txInfo.error = err
      txInfo.errorHandled = txInfo.errorHandled ?? false
    // a middleware in the chain succeeds after error, mark it as handled
    } else if (!err && txInfo.error) {
      txInfo.errorHandled = true
    }
  }

  /**
   * Used to name the segment for a given middleware. This short circuits if name is already provided.
   * That is done for use cases where the name does not confirm to `Nodejs/Middleware/<framework>/<handler name>/<route>`
   *
   * @param {object} params to function
   * @param {Function} params.handler middleware handler function
   * @param {string} params.prefix prefix of name, defaults to `this.prefix`
   * @param {string} params.route path of route for middleware
   * @param {boolean} params.errorWare flag to indicate middleware is error handler
   * @param {string} params.segmentName predefined segment name, short circuits composable naming
   * @returns {string} name of segment for given middleware function
   */
  nameSegment({ handler, prefix = this.prefix, route, errorWare, segmentName }) {
    if (segmentName) {
      return segmentName
    }

    const fnName = getFunctionName(handler)

    if (route && route !== '/' && !errorWare) {
      return `${prefix}/${fnName}/${route}`
    }
    return `${prefix}/${fnName}`
  }

  /**
   * Constructs the timeslice metric name for a given middleware function.
   * If the segmentName is provided it does not create a recorder as these do not get timeslice metrics
   *
   * @param {object} params to function
   * @param {Function} params.handler middleware handler function
   * @param {Transaction} params.transaction active transaction
   * @param {string} params.segmentName predefined segment name, short circuits composable naming
   * @returns {Function | null} a middleware recorder function or null
   */
  constructRecorder({ handler, transaction, segmentName }) {
    // if segmentName is defined that means we do not record any metrics
    // this is because this is typically a middleware handler
    if (segmentName) {
      return null
    }

    const fnName = getFunctionName(handler)
    const path = transaction.nameState.getPath() || '/'
    const metricName = `${this.prefix}/${fnName}/${path}`
    this.logger.trace('Registering middleware recorder with name %s', metricName)
    return makeMiddlewareRecorder(metricName)
  }
}

module.exports = MiddlewareWrapper
