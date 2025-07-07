/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbSubscriber = require('./db')
const recordOperationMetrics = require('../metrics/recorders/database-operation')
const { DB } = require('../metrics/names')

class DbOperationSubscriber extends DbSubscriber {
  handler(data, ctx) {
    const name = `${DB.OPERATION}/${this.system}/${this.operation}`
    const segment = this._agent.tracer.createSegment({
      name,
      parent: ctx.segment,
      recorder: recordOperationMetrics.bind(this),
      transaction: ctx.transaction
    })

    this.addAttributes(segment)
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }
}

module.exports = DbOperationSubscriber
