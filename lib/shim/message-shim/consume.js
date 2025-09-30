/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericRecorder = require('../../metrics/recorders/generic')
const { _nameMessageSegment } = require('./common')

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
 * @param {object} params.ctx this binding of the original function
 * @param {MessageSpec} params.spec spec for the wrapped consume function
 * @returns {MessageSpec} new spec
 */
function updateSpecFromArgs({ shim, fn, fnName, args, spec, ctx }) {
  let msgDesc = null
  if (shim.isFunction(spec)) {
    msgDesc = spec.call(ctx, shim, fn, fnName, args)
  } else {
    msgDesc = spec
  }

  const destNameIsArg = shim.isNumber(msgDesc.destinationName)
  if (destNameIsArg) {
    const destIdx = shim.normalizeIndex(args.length, msgDesc.destinationName)
    if (destIdx !== null) {
      msgDesc.destinationName = args[destIdx]
    }
  }

  return msgDesc
}

/**
 *
 * @private
 * @param {object} params to function
 * @param {MessageShim} params.shim instance of shim
 * @param {Function} params.fn function that is being wrapped
 * @param {string} params.fnName name of function
 * @param {Array} params.args arguments passed to original consume function
 * @param {specs.MessageSpec} params.spec spec for the wrapped consume function
 * @returns {specs.MessageSpec} updated spec with logic to name segment and apply the genericRecorder
 */
function createRecorder({ spec, shim, fn, fnName, args }) {
  const msgDesc = updateSpecFromArgs({ shim, fn, fnName, args, spec, ctx: this })
  // Adds details needed by createSegment when used with a spec
  msgDesc.name = _nameMessageSegment(shim, msgDesc, shim._metrics.CONSUME)
  msgDesc.recorder = genericRecorder
  return msgDesc
}
