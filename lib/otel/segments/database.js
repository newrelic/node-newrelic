/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  SEMATTRS_DB_MONGODB_COLLECTION,
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_SQL_TABLE,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_STATEMENT,
  DbSystemValues
} = require('@opentelemetry/semantic-conventions')
const parseSql = require('../../db/query-parsers/sql')

// TODO: This probably has some holes
// I did analysis and tried to apply the best logic
// to extract table/operation
module.exports = function createDbSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = setName(otelSpan)
  const segment = agent.tracer.createSegment({
    name,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}

function parseStatement(otelSpan, system) {
  let table = otelSpan.attributes[SEMATTRS_DB_SQL_TABLE]
  let operation = otelSpan.attributes[SEMATTRS_DB_OPERATION]
  const statement = otelSpan.attributes[SEMATTRS_DB_STATEMENT]
  if (statement && !(table || operation)) {
    const parsed = parseSql({ sql: statement })
    if (parsed.operation && !operation) {
      operation = parsed.operation
    }

    if (parsed.collection && !table) {
      table = parsed.collection
    }
  }
  if (system === DbSystemValues.MONGODB) {
    table = otelSpan.attributes[SEMATTRS_DB_MONGODB_COLLECTION]
  }

  if (system === DbSystemValues.REDIS && statement) {
    ;[operation] = statement.split(' ')
  }

  table = table || 'Unknown'
  operation = operation || 'Unknown'

  return { operation, table }
}

function setName(otelSpan) {
  const system = otelSpan.attributes[SEMATTRS_DB_SYSTEM]
  const { operation, table } = parseStatement(otelSpan, system)
  let name = `Datastore/statement/${system}/${table}/${operation}`
  // All segment name shapes are same except redis/memcached
  if (system === DbSystemValues.REDIS || system === DbSystemValues.MEMCACHED) {
    name = `Datastore/operation/${system}/${operation}`
  }
  return name
}
