/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

//               (       `  database` .     `    table ` )
const CLEANER = /^\(?(?:([`'"]?)(.*?)\1\.)?([`'"]?)(.*?)\3\)?$/

function StatementMatcher(operation, operationPattern) {
  this.operation = operation
  this.matcher = new RegExp('^\\s*' + operation, 'ig')
  this.operationPattern = operationPattern
}

StatementMatcher.prototype.getParsedStatement = function getParsedStatement(sql) {
  this.operationPattern.lastIndex = 0
  this.matcher.lastIndex = 0
  CLEANER.lastIndex = 0

  if (this.matcher.test(sql)) {
    const queryMatch = this.operationPattern.exec(sql)
    let collection = queryMatch ? queryMatch[1] : 'unknown'
    let database = null

    // If the cleaner can match this collection, pull out the cleaned up names
    // from there. The spec doesn't want the database names in the collection
    // name, but for legacy reasons we keep it.
    // TODO: Either update the spec (and CATs) to accept database name in the
    // collection name or remove it here.
    const cleanerMatch = CLEANER.exec(collection)
    if (cleanerMatch && cleanerMatch[4]) {
      collection = cleanerMatch[4]
      if (cleanerMatch[2]) {
        database = cleanerMatch[2]
        collection = database + '.' + collection
      }
    }

    // TODO: Pass through the database here to the parsed statement. It could
    // be used for datastore attributes.
    return {
      operation: this.operation,
      database: database,
      collection: collection,
      query: sql
    }
  }

  return null
}

module.exports = StatementMatcher
