/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbSubscriber = require('./db')
const recordOperationMetrics = require('../metrics/recorders/database-operation')
const { DB } = require('../metrics/names')

/**
 * Subscriber for database operation events e.g. `connect`.
 *
 * You must define `this.operation` when inheriting from this class.
 */
class DbOperationSubscriber extends DbSubscriber {
  /**
   * On a tracing channel event specified by `this.events`,
   * this handler will create a new segment with the name
   * `${DB.OPERATION}/${this.system}/${this.operation}`.
   *
   * @param {*} data event data
   * @param {Context} ctx our context
   * @returns {Context} updated context with the new segment
   */
  handler(data, ctx) {
    const name = `${DB.OPERATION}/${this.system}/${this.operation}`
    return this.createSegment({
      name,
      ctx,
      recorder: recordOperationMetrics.bind(this),
    })
  }
}

module.exports = DbOperationSubscriber
