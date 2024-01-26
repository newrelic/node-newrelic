/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  assignError,
  getTransactionInfo,
  isError,
  makeGetReq,
  MIDDLEWARE_TYPE_NAMES
} = require('./common')
const { assignCLMSymbol } = require('../../util/code-level-metrics')

const MIDDLEWARE_TYPE_DETAILS = {
  APPLICATION: { name: 'Mounted App: ', path: true, record: false },
  ERRORWARE: { name: '', path: false, record: true },
  MIDDLEWARE: { name: '', path: false, record: true },
  PARAMWARE: { name: '', path: false, record: true },
  ROUTE: { name: 'Route Path: ', path: true, record: false },
  ROUTER: { name: 'Router: ', path: true, record: false }
}

/**
 * Retrieves the route from the spec
 *
 * @private
 * @param {object} spec middleware spec
 * @param {Shim} shim instance of shim
 * @returns {string} route route path
 */
function getRoute(spec, shim) {
  let route = spec.route || '/'

  if (shim.isFunction(route)) {
    route = route()
  }

  if (route instanceof RegExp) {
    route = '/' + route.source + '/'
  } else if (shim.isArray(route)) {
    route = route.join(',')
  } else if (route[0] !== '/') {
    route = '/' + route
  }

  return route
}

/**
 * Retrieves the parameters from the spec.params
 * and prefixes them all with `request.parameters.route`
 *
 * @private
 * @param {object} params object passed to fn
 * @param {object} params.spec middleware spec
 * @param {Shim} params.shim instance of shim
 * @param {Function} params.fn middleware function
 * @param {string} params.fnName function name
 * @param {Array} params.args arguments passed to middleware function
 * @param {object} params.req request object
 * @returns {object} parameters object
 */
function copyParams({ spec, shim, fn, fnName, args, req }) {
  // Copy over route parameters onto the transaction root.
  const params = shim.agent.config.high_security
    ? null
    : spec.params.call(this, shim, fn, fnName, args, req)

  // Route parameters are handled here, query parameters are handled in lib/transaction/index.js#_markAsWeb as part of finalization
  return shim.prefixRouteParameters(params)
}

/**
 * Creates the middleware recorder if the type specifies this flag
 *
 * @private
 * @param {object} params object passed to fn
 * @param {object} params.txInfo transaction
 * @param {object} params.typeDetails metadata about the middleware type
 * @param {Shim} params.shim instance of shim
 * @param {string} params.metricName metric name for middleware function
 * @returns {Function} recorder for middleware type
 */
function constructRecorder({ txInfo, typeDetails, shim, metricName }) {
  let recorder = null
  if (typeDetails.record) {
    const stackPath = txInfo.transaction.nameState.getPath() || ''
    recorder = _makeMiddlewareRecorder(shim, metricName + '/' + stackPath)
  }
  return recorder
}

/**
 * Updates nameState and errorHandled property of transaction info
 *
 * @private
 * @param {object} params object passed to fn
 * @param {Shim} params.shim instance of shim
 * @param {string} params.fnName function name
 * @param {string} params.route route path
 * @param {object} params.req request object
 * @param {boolean} params.isErrorWare indicates if it is error middleware
 * @returns {object| null} updated transaction info
 */
function assignTxInfo({ shim, req, route, fnName, isErrorWare }) {
  // Fetch the transaction information from that request.
  const txInfo = getTransactionInfo(shim, req)
  if (!txInfo || !txInfo.transaction) {
    shim.logger.debug(
      { txInfo: txInfo },
      'Could not get transaction info in %s (%s)',
      route,
      fnName
    )
    return null
  }
  txInfo.transaction.nameState.setPrefix(shim._metrics.FRAMEWORK)
  txInfo.errorHandled |= isErrorWare
  return txInfo
}

/**
 * Recorder for middleware that is a callback
 *
 * When called it will update transaction names, create a recorder for the middleware functions,
 * assign parameters from request, and name the segment
 *
 * @private
 * @param {object} params fn params
 * @param {object} params.spec middleware spec
 * @param {object} params.typeDetails metadata about the middleware type
 * @param {string} params.metricName metric name for middleware function
 * @param {boolean} params.isErrorWare flag indicating if errors are handled by function
 * @returns {Function} recorder function
 */
function middlewareWithCallbackRecorder({ spec, typeDetails, metricName, isErrorWare }) {
  return function callbackRecorder(shim, fn, fnName, args) {
    const route = getRoute(spec, shim)
    // Pull out the request object.
    const req = getReq(spec, shim).call(this, shim, fn, fnName, args)

    const txInfo = assignTxInfo({ shim, req, route, fnName, isErrorWare })

    if (!txInfo || !txInfo.transaction) {
      return null
    }

    const params = copyParams.call(this, { spec, shim, fn, fnName, args, req })
    const nextWrapper = wrapNextHandler({
      shim,
      spec,
      route,
      args,
      isErrorWare,
      isPromise: false,
      txInfo
    })

    // Append this middleware's mount point if it's not an errorware...
    // (to avoid doubling up, a la 'WebTransaction/Expressjs/GET//test/test')
    if (!isErrorWare && spec.appendPath) {
      txInfo.transaction.nameState.appendPath(route, params)
    }

    const recorder = constructRecorder({ txInfo, typeDetails, shim, metricName })

    const segmentName = getSegmentName(metricName, typeDetails, route)

    // Finally, return the segment descriptor.
    return {
      name: segmentName,
      callback: nextWrapper,
      parent: txInfo.segmentStack[txInfo.segmentStack.length - 1],
      recorder: recorder,
      parameters: params,
      after: function afterExec(shim, _fn, _name, err) {
        const errIsError = isError(shim, err)
        if (errIsError) {
          assignError(txInfo, err)
        } else if (!nextWrapper && !isErrorWare && spec.appendPath) {
          txInfo.transaction.nameState.popPath(route)
        }
        if (errIsError || !nextWrapper) {
          txInfo.segmentStack.pop()
        }
      }
    }
  }
}

/**
 * Recorder for middleware that is a promise
 *
 * When called it will update transaction names, create a recorder for the middleware functions,
 * assign parameters from request, and name the segment
 *
 * @private
 * @param {object} params fn params
 * @param {object} params.spec middleware spec
 * @param {object} params.typeDetails metadata about the middleware type
 * @param {string} params.metricName metric name for middleware function
 * @param {boolean} params.isErrorWare flag indicating if errors are handled by function
 * @returns {Function} recorder function
 */
function middlewareWithPromiseRecorder({ spec, typeDetails, metricName, isErrorWare }) {
  return function promiseRecorder(shim, fn, fnName, args) {
    const route = getRoute(spec, shim)

    // Pull out the request object.
    const req = getReq(spec, shim).call(this, shim, fn, fnName, args)
    const txInfo = assignTxInfo({ shim, req, route, fnName, isErrorWare })

    if (!txInfo || !txInfo.transaction) {
      return null
    }

    const params = copyParams.call(this, { spec, shim, fn, fnName, args, req })
    // Append this middleware's mount point and possibly construct a recorder.
    if (spec.appendPath) {
      txInfo.transaction.nameState.appendPath(route, params)
    }

    const recorder = constructRecorder({ txInfo, typeDetails, shim, metricName })
    const nextWrapper = wrapNextHandler({
      shim,
      spec,
      route,
      args,
      isErrorWare,
      isPromise: true,
      txInfo
    })
    const segmentName = getSegmentName(metricName, typeDetails, route)

    // Finally, return the segment descriptor.
    return {
      name: segmentName,
      parent: txInfo.segmentStack[txInfo.segmentStack.length - 1],
      promise: spec.promise,
      callback: nextWrapper,
      recorder: recorder,
      parameters: params,
      after: function afterExec(shim, _fn, _name, err, result) {
        if (shim._responsePredicate(args, result)) {
          txInfo.transaction.nameState.freeze()
        }
        if (isError(shim, err)) {
          assignError(txInfo, err)
        } else {
          txInfo.errorHandled = true

          if (spec.appendPath) {
            txInfo.transaction.nameState.popPath(route)
          }
        }
        txInfo.segmentStack.pop()
      }
    }
  }
}

/**
 * Constructs segment name passed on path/route information
 *
 * @private
 * @param {string} metricName metric name for middleware function
 * @param {object} typeDetails metadata about the middleware type
 * @param {string} route route path
 * @returns {string} name given to segment
 */
function getSegmentName(metricName, typeDetails, route) {
  let segmentName = metricName
  if (typeDetails.path) {
    segmentName += route
  } else if (route.length > 1) {
    segmentName += '/' + route
  }

  return segmentName
}

/**
 * Retrieves the req function that is called to retrieve the request
 *
 * @private
 * @param {object} spec middleware spec
 * @param {Shim} shim instance of shim
 * @returns {Function} function to call to obtain request object
 */
function getReq(spec, shim) {
  return shim.isFunction(spec.req) ? spec.req : makeGetReq(shim, spec.req)
}

/**
 * Wraps the given function in a middleware recorder function.
 *
 * @private
 * @param {Shim} shim instance of shim
 *  The shim used for this instrumentation.
 * @param {Function} middleware
 *  The middleware function to record.
 * @param {object} spec
 *  The spec describing the middleware.
 * @returns {Function} The middleware function wrapped in a recorder.
 */
module.exports._recordMiddleware = function _recordMiddleware(shim, middleware, spec) {
  const typeDetails = MIDDLEWARE_TYPE_DETAILS[spec.type]
  const isErrorWare = spec.type === MIDDLEWARE_TYPE_NAMES.ERRORWARE
  const name = spec.name || shim.getName(shim.getOriginal(middleware))
  let metricName = shim._metrics.PREFIX + typeDetails.name
  if (typeDetails.record) {
    metricName = shim._metrics.MIDDLEWARE + metricName + name
  }

  assignCLMSymbol(shim, middleware)

  return shim.record(
    middleware,
    spec.promise
      ? middlewareWithPromiseRecorder({ spec, typeDetails, metricName, isErrorWare })
      : middlewareWithCallbackRecorder({ spec, typeDetails, metricName, isErrorWare })
  )
}

/**
 * Creates a recorder for middleware metrics.
 *
 * @private
 * @param {object} _shim instance of shim
 * @param {string} metricName name of metric
 * @returns {Function} recorder for middleware
 */
function _makeMiddlewareRecorder(_shim, metricName) {
  return function middlewareMetricRecorder(segment, scope) {
    const duration = segment.getDurationInMillis()
    const exclusive = segment.getExclusiveDurationInMillis()
    const transaction = segment.transaction

    if (scope) {
      transaction.measure(metricName, scope, duration, exclusive)
    }
    transaction.measure(metricName, null, duration, exclusive)
  }
}

/**
 * Wrap the `next` middleware function and push on our name state if we find it. We only want to
 * push the name state if there is a next so that we can safely remove it
 * if context leaves this middleware.
 *
 * @param root0
 * @param root0.shim
 * @param root0.spec
 * @param root0.route
 * @param root0.args
 * @param root0.isErrorWare
 * @param root0.isPromise
 * @param root0.txInfo
 * @private
 */
function wrapNextHandler({ shim, spec, route, args, isErrorWare, isPromise, txInfo }) {
  let nextWrapper = null

  if (isPromise) {
    nextWrapper = function pushSegment(_shim, _fn, _name, segment) {
      txInfo.segmentStack.push(segment)
    }
  }

  if (shim.isFunction(spec.next)) {
    const nextDetails = {
      route,
      wrapNext: spec.next,
      isErrorWare,
      isPromise,
      appendPath: spec.appendPath
    }

    nextWrapper = _makeNextBinder(nextDetails, txInfo)
  } else {
    const nextIdx = shim.normalizeIndex(args.length, spec.next)
    if (nextIdx !== null && args[nextIdx] instanceof Function) {
      const nextDetails = {
        route,
        wrapNext: function wrapNext(s, f, n, _args, wrap) {
          wrap(_args, nextIdx)
        },
        isErrorWare,
        isPromise,
        appendPath: spec.appendPath
      }

      nextWrapper = _makeNextBinder(nextDetails, txInfo)
    }
  }

  return nextWrapper
}

/**
 * Assigns the active segment to stack and wraps the next function
 *
 * @private
 * @param {object} nextDetails details about the function
 * @param {object} txInfo transaction
 * @returns {Function} wrapped function
 */
function _makeNextBinder(nextDetails, txInfo) {
  return function bindNext(shim, fn, _name, segment, args) {
    if (!segment) {
      return
    }
    txInfo.segmentStack.push(segment)

    nextDetails.wrapNext(
      shim,
      fn,
      _name,
      args,
      wrapNextFn.bind(null, { shim, txInfo, nextDetails, segment })
    )
  }
}

/**
 *
 * Called from outside to wrap functions that could be called to continue to the next middleware
 *
 * @private
 * @param {object} params params as 1st arg
 * @param {object} params.shim instance of shim
 * @param {object} params.txInfo transaction
 * @param {object} params.nextDetails details about the function
 * @param {object} params.segment active segment
 * @param {Function} nodule module to wrap
 * @param {string} property name of function to wrap
 * @param {boolean} isFinal flag to indicate last route segment
 */
function wrapNextFn({ shim, txInfo, nextDetails, segment }, nodule, property, isFinal) {
  shim.wrap(nodule, property, function wrapper(shim, original) {
    const parentSegment = segment || shim.getSegment()
    return shim.bindSegment(function boundNext(err) {
      // Only pop the stack if we didn't error. This way the transaction
      // name is derived from the failing middleware.
      if (isError(shim, err)) {
        assignError(txInfo, err)
      } else if (!isFinal && !nextDetails.isErrorWare && nextDetails.appendPath) {
        segment.transaction.nameState.popPath(nextDetails.route)
      }

      // The next call does not signify the end of the segment
      // calling next in the promise case.  Keep the segment on the
      // stack and wait for its promise to be resolved to end it.
      if (!nextDetails.isPromise) {
        txInfo.segmentStack.pop()
        segment.end()
      }
      const ret = original.apply(this, arguments)

      if (nextDetails.isPromise && shim.isPromise(ret)) {
        // After the next call has resolved, we should reinstate the
        // segment responsible for calling next in case there is
        // more work to do in that scope.
        return ret.then(function onNextFinish(v) {
          if (nextDetails.appendPath) {
            segment.transaction.nameState.appendPath(nextDetails.route)
          }

          txInfo.segmentStack.push(segment)

          return v
        })
      }

      return ret
    }, parentSegment) // Bind to parent.
  })
}
