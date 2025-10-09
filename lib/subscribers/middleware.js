/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const { clm, transactionInfo } = require('#agentlib/symbols.js')
const makeMiddlewareRecorder = require('#agentlib/metrics/recorders/middleware.js')
const { addCLMAttributes } = require('#agentlib/util/code-level-metrics.js')
const MW_PREFIX = 'Nodejs/Middleware'

class MiddlewareSubscriber extends Subscriber {
  constructor({ agent, logger, packageName, channelName, system }) {
    super({ agent, logger, packageName, channelName })
    // this is because the handler simply wraps a function
    // that is executed later when a request is made
    this.requireActiveTx = false
    this.system = system
    this.prefix = `${MW_PREFIX}/${this.system}`
    this.agent.environment.setFramework(system)
  }

  /**
   * Used to wrap all middleware handlers.  This checks if it is callback based,
   * or promise based, and propagates context accordingly.
   *
   * @param {object} params to function
   * @param {Function} params.handler the function getting wrapped
   * @param {string} params.hookName value of hook name (not present if this is wrapping a route handler or middleware)
   * @param {string} params.route route that is serving the handler
   * @param {number} params.nextIdx index of next handler, defaults to -1
   * @returns {Function} a wrapped function used to record a segment and assign necessary transaction data
   */
  wrapHandler({ handler, hookName, route, routePrefix, nextIdx = -1 }) {
    const self = this
    function wrappedHandler (...args) {
      const ctx = self.agent.tracer.getContext()
      const transaction = ctx?.transaction
      transaction.nameState.setPrefix(self.system)
      const { txInfo, errorWare, request } = self.extractTxInfo(args, route)
      if (route && !errorWare) {
        transaction.nameState.appendPath(route, request.params)
      }

      const parent = ctx?.segment
      const name = self.nameSegment({ handler, hookName, route, routePrefix, errorWare })
      const recorder = self.constructRecorder({ handler, transaction, routePrefix })
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

      segment.start()
      self.logger.trace('Created segment %s, parent %s', segment?.name, parent?.name)

      if (self.config.code_level_metrics.enabled === true) {
        handler[clm] = true
        addCLMAttributes(handler, segment)
      }
      const newCtx = ctx.enterSegment({ segment })

      self.wrapDoneHandler({ segment, ctx, args, handler, txInfo, route, nextIdx })

      try {
        const result = self.agent.tracer.bindFunction(handler, newCtx, true).apply(this, args)
        if (result?.then) {
          return result.then(function onThen(val) {
            segment.touch()
            return val
          },
          function onCatch(err) {
            self.storeError(txInfo, err)
            segment.touch()
            throw err
          })
        }
        return result
      } catch (err) {
        self.storeError(txInfo, err)
        throw err
      }
    }
    Object.defineProperties(wrappedHandler, {
      name: { value: handler.name },
      length: { value: handler.length }
    })
    return wrappedHandler
  }

  extractTxInfo(args, route) {
    let errorWare = false
    let [request] = args
    // 4 args indicates an error handler middleware
    if (args.length === 4) {
      ;[, request] = args
      errorWare = true
      route = null
    }
    const txInfo = request?.raw?.[transactionInfo] || request?.[transactionInfo]
    if (errorWare) {
      txInfo.errorHandled = errorWare
    }
    return { txInfo, request, errorWare }
  }

  wrapDoneHandler({ args, segment, ctx, handler, txInfo, route, nextIdx }) {
    const self = this
    const doneFn = args.at(nextIdx)
    const isSync = typeof doneFn === 'function' &&
      handler.constructor.name !== 'AsyncFunction'

    if (isSync) {
      function wrappedDone(...doneArgs) {
        const [err] = doneArgs
        if (err) {
          self.storeError(txInfo, err)
        // I _think_ this is mostly for express
        // it has composable routers and we want to
        // pop off routes that did nothing for some reason
        // I may just provide some way to run some code before done handler
        } else if (route) {
          route = Array.isArray(route) ? route.join(',') : route
          ctx?.transaction?.nameState?.popPath(route)
        }

        segment.touch()
        return doneFn.apply(this, doneArgs)
      }
      Object.defineProperties(wrappedDone, {
        name: { value: doneFn.name },
        length: { value: doneFn.length }
      })
      // binding previous ctx as it should restore once this cb is executed
      const bound = self.agent.tracer.bindFunction(wrappedDone, ctx, false)
      if (nextIdx === -1) {
        args[args.length - 1] = bound
      } else {
        args[nextIdx] = bound
      }
    }
  }

  /**
   * Errors are handled in `lib/instrumentation/core/http.js` when the
   * http response is ended. This is because it has to check if the status
   * code is being ignored via config
   * @param {object} txInfo object storing transaction, error, segmentStack(not used in migrated subscribers)
   * @param {Error} err error that occurred
   */
  storeError(txInfo, err) {
    txInfo.error = err
    txInfo.errorHandled = txInfo.errorHandled ?? false
  }

  nameSegment({ handler, hookName, route, routePrefix, errorWare }) {
    let name = this.prefix
    const fnName = handler.name === '' ? '<anonymous>' : handler.name
    if (hookName) {
      name += `/${hookName}/${fnName}`
      if (route) {
        name += `/${route}`
      }
    } else if (routePrefix && route) {
      name = `${this.system}/${routePrefix}${route}`
    } else if (route && route !== '/' && !errorWare) {
      name += `/${fnName}/${route}`
    } else {
      name += `/${fnName}`
    }
    return name
  }

  constructRecorder({ handler, transaction, routePrefix }) {
    // metrics are not recorded when routePrefix is present
    if (routePrefix) {
      return null
    }

    let metricName = this.prefix
    const fnName = handler.name === '' ? '<anonymous>' : handler.name
    metricName += `/${fnName}`
    const path = transaction.nameState.getPath() || '/'
    metricName += `/${path}`
    this.logger.trace('Registering middleware recorder with name %s', metricName)
    return makeMiddlewareRecorder(metricName)
  }
}

module.exports = MiddlewareSubscriber
