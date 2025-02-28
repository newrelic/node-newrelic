/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { otelSynthesis } = require('../symbols')
const FakeSpan = require('./fake-span')
const Context = require('../context-manager/context')

module.exports = class OtelContext extends Context {
  constructor(transaction, segment, parentContext) {
    super(transaction, segment)
    this._otelCtx = parentContext ? new Map(parentContext) : new Map()
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
  enterSegment({ segment, transaction = this._transaction }) {
    this._otelCtx.set(transaction.agent.otelSpanKey, new FakeSpan(segment, transaction))
    return new this.constructor(transaction, segment, this._otelCtx)
  }

  /**
   * Constructs a new context from transaction about to be bound to context manager.
   * It uses the trace root segment as the segment in context. It will also bind a FakeSpan to the `_otelCtx`.
   *
   * @param {Transaction} transaction transaction to bind to context
   * @returns {OtelContext} a newly constructed context
   */
  enterTransaction(transaction) {
    this._otelCtx.set(transaction.agent.otelSpanKey, new FakeSpan(transaction.trace.root, transaction))
    return new this.constructor(transaction, transaction.trace.root, this._otelCtx)
  }

  /**
   * Used to retrieve data from `_otelCtx`
   *
   * @param {string} key Stored entity name to retrieve.
   *
   * @returns {*} The stored value.
   */
  getValue(key) {
    return this._otelCtx.get(key)
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
      ctx = new this.constructor(transaction, segment, this._otelCtx)
    } else {
      ctx = new this.constructor(this._transaction, this._segment, this._otelCtx)
    }

    ctx._otelCtx.set(key, value)
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
    const ctx = new this.constructor(this._transaction, this._segment, this._otelCtx)
    ctx._otelCtx.delete(key)
    return ctx
  }
}
