/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Class for managing state in the agent.
 * Keeps track of a single context instance.
 *
 * Given current usage with every instrumented function, the functions in this
 * class should do as little work as possible to avoid unnecessary overhead.
 *
 * @class
 */
class LegacyContextManager {
  /**
   * @param {object} config New Relic config instance
   */
  constructor(config) {
    this._config = config
    this._context = null
  }

  /**
   * Get the currently active context.
   *
   * @returns {object} The current active context.
   */
  getContext() {
    return this._context
  }

  /**
   * Set a new active context. Not bound to function execution.
   *
   * @param {object} newContext The context to set as active.
   */
  setContext(newContext) {
    this._context = newContext
  }

  /**
   * Run a function with the passed in context as the active context.
   * Restores the previously active context upon completion.
   *
   * @param {object} context The context to set as active during callback execution.
   * @param {Function} callback The function to execute in context.
   * @param {Function} [cbThis] Optional `this` to apply to the callback.
   * @param {Array<*>} [args] Optional arguments object or args array to invoke the callback with.
   * @returns {*} Returns the value returned by the callback function.
   */
  runInContext(context, callback, cbThis, args) {
    const oldContext = this.getContext()
    this.setContext(context)

    try {
      return callback.apply(cbThis, args)
    } finally {
      this.setContext(oldContext)
    }
  }
}

module.exports = LegacyContextManager
