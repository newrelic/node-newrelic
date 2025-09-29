/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api.ContextManager.html
 */
class ContextManager {
  #ctxMgr

  constructor(agent) {
    this.#ctxMgr = agent.tracer._contextManager
  }

  active() {
    return this.#ctxMgr.getContext()
  }

  bind(context, target) {
    return boundContext.bind(this)

    function boundContext(...args) {
      return this.with(context, target, this, ...args)
    }
  }

  /**
   * Runs the callback within the provided context, optionally
   * bound with a provided `this`.
   *
   * @param {object} context context
   * @param {Function} callback callback
   * @param {object} thisRef `this` reference
   * @param {...any} args arguments
   */
  with(context, callback, thisRef, ...args) {
    return this.#ctxMgr.runInContext(context, callback, thisRef, args)
  }

  enable() {
    return this
  }

  disable() {
    return this
  }
}

module.exports = ContextManager
