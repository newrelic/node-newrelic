/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { otelSynthesis } = require('../symbols')
const FakeSpan = require('./fake-span')
const Context = require('../context-manager/context')

module.exports = class OtelContext extends Context {
  constructor({ transaction, segment, otelContext, extras } = {}) {
    super({ transaction, segment, extras })
    this._otelCtx = otelContext ? new Map(otelContext) : new Map()
  }

  get otelCtx() {
    return this._otelCtx
  }

  /**
   * Constructs a new context from segment about to be bound to context manager
   * along with the current transaction. It will also bind a FakeSpan to the `_otelCtx`
   *
   * @param {object} params to function
   * @param {TraceSegment} params.segment segment to bind to context
   * @param {Transaction} params.transaction active transaction
   * @returns {OtelContext} a newly constructed context
   */
  enterSegment({ segment, transaction = this.transaction }) {
    if (transaction?.agent?.otelSpanKey && segment) {
      this.otelCtx.set(transaction.agent.otelSpanKey, new FakeSpan(segment, transaction))
    }
    return new this.constructor({ transaction, segment, otelContext: this.otelCtx, extras: this.extras })
  }

  /**
   * Constructs a new context from transaction about to be bound to context manager.
   * It uses the trace root segment as the segment in context. It will also bind a FakeSpan to the `_otelCtx`.
   *
   * @param {Transaction} transaction transaction to bind to context
   * @returns {OtelContext} a newly constructed context
   */
  enterTransaction(transaction) {
    if (transaction?.agent?.otelSpanKey) {
      this.otelCtx.set(transaction.agent.otelSpanKey, new FakeSpan(transaction.trace.root, transaction))
    }
    return new this.constructor({ transaction, segment: transaction?.trace?.root, otelContext: this.otelCtx, extras: this.extras })
  }

  /**
   * Used to retrieve data from `_otelCtx`
   *
   * @param {string} key Stored entity name to retrieve.
   *
   * @returns {*} The stored value.
   */
  getValue(key) {
    return this.otelCtx.get(key)
  }

  /**
   * Used to set data on `_otelCtx`
   *
   * @param {string} key Name for stored value.
   * @param {*} value Value to store.
   *
   * @returns {OtelContext} The context object.
   */
  setValue(key, value) {
    let ctx

    if (value[otelSynthesis] && value[otelSynthesis].segment && value[otelSynthesis].transaction) {
      const { segment, transaction } = value[otelSynthesis]
      segment.start()
      ctx = new this.constructor({ transaction, segment, otelContext: this.otelCtx, extras: this.extras })
    } else {
      ctx = new this.constructor({ transaction: this.transaction, segment: this.segment, otelContext: this.otelCtx, extras: this.extras })
    }

    ctx.otelCtx.set(key, value)
    return ctx
  }

  /**
   * Used to remove data from `_otelCtx`
   *
   * @param {string} key Named value to remove from the store.
   *
   * @returns {OtelContext} The context object.
   */
  deleteValue(key) {
    const ctx = new this.constructor({ transaction: this._transaction, segment: this._segment, otelContext: this.otelCtx, extras: this.extras })
    ctx.otelCtx.delete(key)
    return ctx
  }
}
