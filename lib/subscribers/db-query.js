/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbSubscriber = require('./db')
const recordQueryMetrics = require('../metrics/recorders/database')
const { DB } = require('../metrics/names')
const ParsedStatement = require('../db/parsed-statement')
const parseSql = require('../db/query-parsers/sql')

class DbQuerySubscriber extends DbSubscriber {
  handler(data, ctx) {
    const queryString = this.queryString
    const parsed = this.parseQueryString(queryString)
    const name = `${DB.STATEMENT}/${this.system}/${parsed.collection}/${parsed.operation}`
    const segment = this._agent.tracer.createSegment({
      name,
      parent: ctx.segment,
      recorder: recordQueryMetrics.bind(parsed),
      transaction: ctx.transaction
    })

    segment.opaque = this.opaque

    this.addAttributes(segment)
    const newCtx = ctx.enterSegment({ segment })
    return newCtx
  }

  parseQueryString(queryString) {
    const parsed = this.parseQuery(queryString)
    let collection = parsed.collection
    // strip enclosing special characters from collection (table) name
    if (typeof collection === 'string' && collection.length > 2) {
      if (/^[[{'"`]/.test(collection)) {
        collection = collection.substring(1)
      }
      if (/[\]}'"`]$/.test(collection)) {
        collection = collection.substring(0, collection.length - 1)
      }
    }

    const queryRecorded =
      this.config.transaction_tracer.record_sql === 'raw' ||
      this.config.transaction_tracer.record_sql === 'obfuscated'

    return new ParsedStatement(
      this._metrics.PREFIX,
      parsed.operation,
      collection,
      queryRecorded ? parsed.query : null
    )
  }

  parseQuery(queryString) {
    return parseSql(queryString)
  }
}

module.exports = DbQuerySubscriber
