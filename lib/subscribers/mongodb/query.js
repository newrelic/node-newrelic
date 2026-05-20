/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query')
const { MONGODB } = require('../../metrics/names')
const { getParameters, findCollectionName } = require('./utils')

/**
 * Subscriber for async MongoDB query operations on Collection and Cursor objects.
 * Covers COLLECTION_OPS (Promise-returning) and CURSOR_OPS.
 *
 * Segment name: `Datastore/statement/MongoDB/{collection}/{operation}`
 */
class MongoQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName, packageName = 'mongodb' }) {
    super({ agent, logger, channelName, packageName, system: MONGODB.PREFIX })
    this.events = ['asyncEnd']
    // Prevent internal MongoDB operations (e.g. cursor.next inside findOne) from
    // creating nested child segments under this one.
    this.opaque = true
  }

  handler(data, ctx) {
    // Strip nr_ prefix and any optional class-qualifier prefix (e.g. nr_collection_stats → stats).
    const operation = this.channelName.replace(/^nr_(?:[a-z]+_)?/, '')
    this.queryString = operation
    this._mongoObject = data.self

    const params = getParameters(data.self, this.system)
    // Collection.rename is always routed to the admin database.
    if (operation === 'rename') {
      params.database_name = 'admin'
    }
    this.parameters = params

    return super.handler(data, ctx)
  }

  parseQuery(queryString) {
    return {
      operation: queryString,
      collection: findCollectionName(this._mongoObject),
      query: null
    }
  }
}

module.exports = MongoQuerySubscriber
