/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EXCEPTION = 'uncaughtException'
const REJECTION = 'unhandledRejection'

module.exports = tempOverrideUncaught

const oldListeners = {
  EXCEPTION: [],
  REJECTION: []
}

/**
 * Temporarily removes all listeners for the target exception handler,
 * either `uncaughtException` (default) or `unhandledRejection`, subsequently
 * restoring the original listeners upon test completion.
 *
 * @param {object} params params object
 * @param {TestContext} params.t A `node:test` context object.
 * @param {function} params.handler An error handler function that will replace all
 * current listeners.
 * @param {string} [params.type] The kind of uncaught event to
 * override.
 * @property {string} EXCEPTION Constant value usable for `type`.
 * @property {string} REJECTION Constant value usable for `type`.
 */
function tempOverrideUncaught({ t, handler, type = EXCEPTION }) {
  if (!handler) {
    handler = function uncaughtTestHandler() {}
  }

  oldListeners[type] = process.listeners(type)
  process.removeAllListeners(type)
  process.once(type, (error) => {
    handler(error)
  })

  // We probably shouldn't be adding a `t.after` in this helper. There can only
  // be one `t.after` handler per test, and putting in here obscures the fact
  // that it has been added.
  t.after(() => {
    for (const l of oldListeners[type]) {
      process.on(type, l)
    }
  })
}

Object.defineProperties(tempOverrideUncaught, {
  EXCEPTION: { value: EXCEPTION },
  REJECTION: { value: REJECTION }
})
