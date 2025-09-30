/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { clm, transactionInfo } = require('#agentlib/symbols.js')
const makeMiddlewareRecorder = require('#agentlib/metrics/recorders/middleware.js')
const { addCLMAttributes } = require('#agentlib/util/code-level-metrics.js')
const MW_PREFIX = 'Nodejs/Middleware/Fastify'

function nameSegment({ hookName, handler, route }) {
  let name = MW_PREFIX
  const fnName = handler.name === '' ? '<anonymous>' : handler.name
  if (hookName) {
    name += `/${hookName}/${fnName}`
    if (route) {
      name += `/${route}`
    }
  } else if (route) {
    name += `/${fnName}/${route}`
  }
  return name
}

/**
 * Used to wrap all fastify handlers.  This checks if it is callback based,
 * or promise based, and I _think_ propagates context accordingly
 *
 * @param {object} params to function
 * @param {Function} params.handler the function getting wrapped
 * @param {string} params.hookName value of fastify hook(not present if this is wrapping a route handler or middleware)
 * @param {string} params.route route that is serving the handler
 * @param {object} params.self instance that has agent/logger
 * @returns {Function} a wrapped function used to record a segment and assign necessary transaction data
 */
function handlerWrapper({ handler, hookName, route, self }) {
  const { agent, logger } = self
  return function wrappedHandler (...args) {
    const ctx = agent.tracer.getContext()
    const transaction = ctx?.transaction
    transaction.nameState.setPrefix('Fastify')
    const [request] = args
    const txInfo = request?.raw?.[transactionInfo] || request?.[transactionInfo]
    if (route && !hookName) {
      transaction.nameState.appendPath(route, request.params)
    }

    const parent = ctx?.segment
    const name = nameSegment({ handler, hookName, route })
    const segment = agent.tracer.createSegment({
      name,
      parent,
      recorder: makeMiddlewareRecorder(name),
      transaction
    })

    if (!segment) {
      logger.trace('Failed to create new segment %s, calling original function', name)
      return handler.apply(this, args)
    }
    logger.trace('Created segment %s, parent %s', segment?.name, parent?.name)

    if (agent.config.code_level_metrics.enabled === true) {
      handler[clm] = true
      addCLMAttributes(handler, segment)
    }
    const newCtx = ctx.enterSegment({ segment })

    const doneFn = args[args.length - 1]
    const isSync = typeof doneFn === 'function' &&
      handler.constructor.name !== 'AsyncFunction'
    if (isSync) {
      function wrappedDone(...doneArgs) {
        const [err] = doneArgs
        if (err) {
          storeError(txInfo, err)
        }
        segment.touch()
        return doneFn.apply(this, doneArgs)
      }
      // binding previous ctx as it should restore once this cb is executed
      const bound = agent.tracer.bindFunction(wrappedDone, ctx, false)
      args[args.length - 1] = bound
    }
    try {
      const result = agent.tracer.bindFunction(handler, newCtx, true).apply(this, args)
      if (result?.then) {
        return result.then(function onThen(val) {
          segment.touch()
          return val
        },
        function onCatch(err) {
          storeError(txInfo, err)
          segment.touch()
          throw err
        })
      }
      return result
    } catch (err) {
      storeError(txInfo, err)
      throw err
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
function storeError(txInfo, err) {
  txInfo.error = err
  txInfo.errorHandled = false
}

module.exports = {
  handlerWrapper
}
