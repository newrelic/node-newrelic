/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbOperationSubscriber = require('../db-operation')
const { MONGODB } = require('../../metrics/names')
const { getParameters, operationFromChannel } = require('./utils')

/**
 * Subscriber for async MongoDB operation events on the `Db` class
 * (e.g. `createCollection`, `dropDatabase`, `command`, etc.).
 *
 * Segment name: `Datastore/operation/MongoDB/{operation}`
 */
class MongoOperationSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger, channelName, packageName = 'mongodb' }) {
    super({ agent, logger, channelName, packageName, system: MONGODB.PREFIX })
    this.events = ['asyncEnd']
    this.opaque = true
  }

  handler(data, ctx) {
    const operation = operationFromChannel(this.channelName)
    this.operation = operation
    const params = getParameters(data.self, this.system)
    // Db.renameCollection is always routed to the admin database.
    if (operation === 'renameCollection') {
      params.database_name = 'admin'
    }
    this.parameters = params
    return super.handler(data, ctx)
  }
}

module.exports = MongoOperationSubscriber
