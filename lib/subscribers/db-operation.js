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
    return this.createSegment({
      name,
      ctx,
      recorder: recordOperationMetrics.bind(this),
    })
  }
}

module.exports = DbOperationSubscriber
