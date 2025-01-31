/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { otelSynthesis } = require('../symbols')

module.exports = class Context {
  constructor(transaction, segment, parentContext) {
    this._transaction = transaction
    this._segment = segment
    this._otelCtx = parentContext ? new Map(parentContext) : new Map()
  }

  get segment() {
    return this._segment
  }

  get transaction() {
    return this._transaction
  }

  enterSegment({ segment, transaction = this._transaction }) {
    return new this.constructor(transaction, segment)
  }

  enterTransaction(transaction) {
    return new this.constructor(transaction, transaction.trace.root)
  }

  /**
   * Required for bridging OTEL data into the agent.
   *
   * @param {string} key Stored entity name to retrieve.
   *
   * @returns {*} The stored value.
   */
  getValue(key) {
    return this._otelCtx.get(key)
  }

  /**
   * Required for bridging OTEL data into the agent.
   *
   * @param {string} key Name for stored value.
   * @param {*} value Value to store.
   *
   * @returns {object} The context manager object.
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
   * Required for bridging OTEL data into the agent.
   *
   * @param {string} key Named value to remove from the store.
   *
   * @returns {object} The context manager object.
   */
  deleteValue(key) {
    const ctx = new this.constructor(this._transaction, this._segment, this._otelCtx)
    ctx._otelCtx.delete(key)
    return ctx
  }
}
