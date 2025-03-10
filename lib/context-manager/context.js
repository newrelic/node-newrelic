/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = class Context {
  constructor(transaction, segment) {
    this._transaction = transaction
    this._segment = segment
  }

  get segment() {
    return this._segment
  }

  get transaction() {
    return this._transaction
  }

  /**
   * Constructs a new context from segment about to be bound to context manager
   * along with the current transaction.
   *
   * @param {object} params to function
   * @param {TraceSegment} params.segment segment to bind to context
   * @param {Transaction} params.transaction active transaction
   * @returns {Context} a newly constructed context
   */
  enterSegment({ segment, transaction = this._transaction }) {
    return new this.constructor(transaction, segment)
  }

  /**
   * Constructs a new context from transaction about to be bound to context manager.
   * It uses the trace root segment as the segment in context.
   *
   * @param {Transaction} transaction transaction to bind to context
   * @returns {Context} a newly constructed context
   */
  enterTransaction(transaction) {
    return new this.constructor(transaction, transaction.trace.root)
  }
}
