/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbSubscriber = require('./db')
const recordQueryMetrics = require('../metrics/recorders/database')
const { DB } = require('../metrics/names')
const ParsedStatement = require('../db/parsed-statement')
const parseSql = require('../db/query-parsers/sql')

/**
 * Defines a subscriber for database queries.
 *
 * @property {string} queryString Must be set by any class that extends this
 * one prior to this class's `.handler` method being invoked. It represents
 * the statement being sent to the database.
 * @property {boolean} [isBatch] Set to true if this subscriber is for batch queries.
 */
class DbQuerySubscriber extends DbSubscriber {
  /**
   * On an event, this handler will create a segment with the name
   * `{DB.STATEMENT}/{DB_SYSTEM}/{COLLECTION}/{OPERATION}`.
   * Other than `DB.STATEMENT` which is a constant, these values
   * are extracted from `this.queryString`.
   * @param {object} data event data
   * @param {Context} ctx the context
   * @returns {Context} the updated context with the new segment
   */
  handler(data, ctx) {
    const queryString = this.queryString
    const parsed = this.parseQueryString(queryString)
    let name = `${DB.STATEMENT}/${this.system}/${parsed.collection}/${parsed.operation}`
    if (this.isBatch) {
      name += '/batch'
    }

    return this.createSegment({
      name,
      ctx,
      recorder: recordQueryMetrics.bind(parsed),
    })
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
