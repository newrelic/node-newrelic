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
const recordQueryMetrics = require('../../metrics/recorders/database')
const recordOperationMetrics = require('../../metrics/recorders/database-operation')
const ParsedStatement = require('../../db/parsed-statement')
const metrics = require('../../metrics/names')

// TODO: This probably has some holes
// I did analysis and tried to apply the best logic
// to extract table/operation
module.exports = function createDbSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const system = otelSpan.attributes[SEMATTRS_DB_SYSTEM]
  const parsed = parseStatement(agent.config, otelSpan, system)
  const { name, operation } = setName(parsed)
  const segment = agent.tracer.createSegment({
    name,
    recorder: getRecorder({ operation, parsed, system }),
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}

/**
 * Assigns the appropriate timeslice metrics recorder
 * based on the otel span.
 *
 * @param {object} params to fn
 * @param {ParsedStatement} params.parsed parsed statement of call
 * @param {boolean} params.operation if span is an operation
 * @param {string} params.system `db.system` value of otel span
 * @returns {function} returns a timeslice metrics recorder function based on span
 */
function getRecorder({ parsed, operation, system }) {
  if (operation) {
    const scope = {}
    scope._metrics = {
      PREFIX: system,
      ALL: metrics.DB.PREFIX + system + '/' + metrics.ALL
    }
    return recordOperationMetrics.bind(scope)
  } else {
    return recordQueryMetrics.bind(parsed)
  }
}

/**
 * Creates a parsed statement from various span attributes.
 *
 * @param {object} config agent config
 * @param {object} otelSpan span getting parsed
 * @param {string} system value of `db.system` on span
 * @returns {ParsedStatement} instance of parsed statement
 */
function parseStatement(config, otelSpan, system) {
  let table = otelSpan.attributes[SEMATTRS_DB_SQL_TABLE]
  let operation = otelSpan.attributes[SEMATTRS_DB_OPERATION]
  let statement = otelSpan.attributes[SEMATTRS_DB_STATEMENT]
  if (statement && !(table || operation)) {
    const parsed = parseSql({ sql: statement })
    if (parsed.operation && !operation) {
      operation = parsed.operation
    }

    if (parsed.collection && !table) {
      table = parsed.collection
    }
    statement = parsed.query
  }
  if (system === DbSystemValues.MONGODB) {
    table = otelSpan.attributes[SEMATTRS_DB_MONGODB_COLLECTION]
  }

  if (system === DbSystemValues.REDIS && statement) {
    ;[operation] = statement.split(' ')
  }

  table = table || 'Unknown'
  operation = operation || 'Unknown'
  const queryRecorded =
    config.transaction_tracer.record_sql === 'raw' ||
    config.transaction_tracer.record_sql === 'obfuscated'

  return new ParsedStatement(
    system,
    operation,
    table,
    queryRecorded ? statement : null
  )
}

/**
 * Creates name for db segment based on otel span
 * If the system is redis or memcached the name is an operation name
 *
 * @param {ParsedStatement} parsed statement used for naming segment
 * @returns {string} name of segment
 */
function setName(parsed) {
  let operation = false
  let name = `Datastore/statement/${parsed.type}/${parsed.collection}/${parsed.operation}`
  // All segment name shapes are same except redis/memcached
  if (parsed.type === DbSystemValues.REDIS || parsed.type === DbSystemValues.MEMCACHED) {
    name = `Datastore/operation/${parsed.type}/${parsed.operation}`
    operation = true
  }

  return { name, operation }
}
