/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { langchainRunId } = require('../../symbols')

module.exports = function initialize(shim, callbacks) {
  shim.wrap(
    callbacks.CallbackManager.prototype,
    ['handleChainStart', 'handleToolStart'],
    function wrapStart(shim, orig) {
      return async function wrappedStart() {
        const result = await orig.apply(this, arguments)
        const segment = shim.getActiveSegment()
        if (segment) {
          segment[langchainRunId] = result?.runId
        }

        return result
      }
    }
  )
}
