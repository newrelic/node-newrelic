/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ROOT_CONTEXT } = require('@opentelemetry/api')

/**
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_api.ContextManager.html
 */
class ContextManager {
  #agent

  #ctxMgr

  constructor(agent) {
    this.#agent = agent
    this.#ctxMgr = agent._contextManager
  }

  active() {
    // TODO: get current span(segment?) from agent and prefer it
    const storedContext = this.#ctxMgr.getContext()
    return storedContext || ROOT_CONTEXT
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
   * @param context
   * @param callback
   * @param thisRef
   * @param args
   */
  with(context, callback, thisRef, ...args) {
    return this.#agent._contextManager.runInContext(context, callback, thisRef, args)
  }

  enable() {
    return this
  }
  disable() {
    return this
  }
}

module.exports = ContextManager
