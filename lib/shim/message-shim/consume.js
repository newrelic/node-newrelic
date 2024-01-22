/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const TraceSegment = require('../../transaction/trace/segment')
const genericRecorder = require('../../metrics/recorders/generic')
const { _nameMessageSegment } = require('./common')
const specs = require('../specs')
module.exports = createRecorder

/**
 * Generates the spec for the consumer
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Function} params.fn consumer function
 * @param {string} params.fnName name of function
 * @param {Array} params.args arguments passed to original consume function
 * @param {specs.MessageSpec} params.spec spec for the wrapped consume function
 * @returns {specs.MessageSpec} new spec
 */
function updateSpecFromArgs({ shim, fn, fnName, args, spec }) {
  let msgDesc = null
  if (shim.isFunction(spec)) {
    msgDesc = spec.call(this, shim, fn, fnName, args)
    msgDesc = new specs.MessageSpec(msgDesc)
  } else {
    msgDesc = new specs.MessageSpec(spec)
    const destIdx = shim.normalizeIndex(args.length, spec.destinationName)
    if (destIdx !== null) {
      msgDesc.destinationName = args[destIdx]
    }
  }

  return msgDesc
}

/**
 * Binds the consumer callback to the active segment.
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Array} params.args arguments passed to original consume function
 * @param {specs.MessageSpec} params.msgDesc spec for the wrapped consume function
 * @param {TraceSegment} params.segment active segment to bind callback
 * @param {boolean} params.getParams flag to copy message parameters to segment
 * @param {Function} params.resHandler function to handle response from callback to obtain the message parameters
 */
function bindCallback({ shim, args, msgDesc, segment, getParams, resHandler }) {
  const cbIdx = shim.normalizeIndex(args.length, msgDesc.callback)
  if (cbIdx !== null) {
    shim.bindCallbackSegment(args, cbIdx, segment)

    // If we have a callback and a results handler, then wrap the callback so
    // we can call the results handler and get the message properties.
    if (resHandler) {
      shim.wrap(args, cbIdx, function wrapCb(shim, cb, cbName) {
        if (shim.isFunction(cb)) {
          return function cbWrapper() {
            const cbArgs = shim.argsToArray.apply(shim, arguments)
            const msgProps = resHandler.call(this, shim, cb, cbName, cbArgs)
            if (getParams && msgProps && msgProps.parameters) {
              shim.copySegmentParameters(segment, msgProps.parameters)
            }

            return cb.apply(this, arguments)
          }
        }
      })
    }
  }
}

/**
 * Binds the consumer function to the async context and checks return to possibly
 * bind the promise
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Function} params.fn consumer function
 * @param {string} params.fnName name of function
 * @param {Array} params.args arguments passed to original consume function
 * @param {specs.MessageSpec} params.msgDesc spec for the wrapped consume function
 * @param {TraceSegment} params.segment active segment to bind callback
 * @param {boolean} params.getParams flag to copy message parameters to segment
 * @param {Function} params.resHandler function to handle response from callback to obtain the message parameters
 * @returns {Promise|*} response from consume function
 */
function bindConsumer({ shim, fn, fnName, args, msgDesc, segment, getParams, resHandler }) {
  // Call the method in the context of our segment.
  let ret = shim.applySegment(fn, segment, true, this, args)

  if (ret && msgDesc.promise && shim.isPromise(ret)) {
    ret = shim.bindPromise(ret, segment)

    // Intercept the promise to handle the result.
    if (resHandler) {
      ret = ret.then(function interceptValue(res) {
        const msgProps = resHandler.call(this, shim, fn, fnName, res)
        if (getParams && msgProps && msgProps.parameters) {
          shim.copySegmentParameters(segment, msgProps.parameters)
        }
        return res
      })
    }
  }

  return ret
}

/**
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Function} params.fn function that is being wrapped
 * @param {string} params.fnName name of function
 * @param {specs.MessageSpec} params.spec spec for the wrapped consume function
 * @returns {Function} recorder for consume function
 */
function createRecorder({ shim, fn, fnName, spec }) {
  return function consumeRecorder() {
    const parent = shim.getSegment()
    if (!parent || !parent.transaction.isActive()) {
      shim.logger.trace('Not recording consume, no active transaction.')
      return fn.apply(this, arguments)
    }

    // Process the message args.
    const args = shim.argsToArray.apply(shim, arguments)
    const msgDesc = updateSpecFromArgs.call(this, { shim, fn, fnName, args, spec })

    // Make the segment if we can.
    if (!msgDesc) {
      shim.logger.trace('Not recording consume, no message descriptor.')
      return fn.apply(this, args)
    }

    const name = _nameMessageSegment(shim, msgDesc, shim._metrics.CONSUME)

    // Adds details needed by createSegment when used with a spec
    msgDesc.name = name
    msgDesc.recorder = genericRecorder
    msgDesc.parent = parent

    const segment = shim.createSegment(msgDesc)
    const getParams = shim.agent.config.message_tracer.segment_parameters.enabled
    const resHandler = shim.isFunction(msgDesc.messageHandler) ? msgDesc.messageHandler : null

    bindCallback({ shim, args, msgDesc, segment, getParams, resHandler })
    return bindConsumer.call(this, {
      shim,
      fn,
      fnName,
      args,
      msgDesc,
      segment,
      getParams,
      resHandler
    })
  }
}
