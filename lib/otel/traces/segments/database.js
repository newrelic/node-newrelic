/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const parseSql = require('#agentlib/db/query-parsers/sql.js')
const recordQueryMetrics = require('#agentlib/metrics/recorders/database.js')
const recordOperationMetrics = require('#agentlib/metrics/recorders/database-operation.js')
const ParsedStatement = require('#agentlib/db/parsed-statement.js')
const metrics = require('#agentlib/metrics/names.js')
const { transformTemplate } = require('../utils.js')

module.exports = function createDbSegment(agent, otelSpan, rule) {
  const context = agent.tracer.getContext()
  const segmentTransformation = rule.segmentTransformation
  const system = otelSpan.attributes[segmentTransformation?.type]
  const statement = otelSpan.attributes[segmentTransformation?.statement]
  const collection = otelSpan.attributes[segmentTransformation?.collection]
  let operation = otelSpan.attributes[segmentTransformation?.operation]
  let name, recorder
  if (statement || (operation && collection)) {
    let parsed
    if (collection && operation) {
      parsed = { operation, collection }
    } else {
      parsed = parseSql({ sql: statement })
    }
    const queryRecorded =
      agent.config.transaction_tracer.record_sql === 'raw' ||
      agent.config.transaction_tracer.record_sql === 'obfuscated'

    const parsedStatement = new ParsedStatement(
      system,
      parsed.operation,
      parsed.collection,
      queryRecorded ? statement : null
    )
    name = transformTemplate(segmentTransformation.name.template, parsedStatement)
    recorder = getRecorder({ operation: false, parsed: parsedStatement, system })
  } else if (operation) {
    ;[operation] = operation.split(' ')
    name = transformTemplate(segmentTransformation.name.template, { type: system, operation })
    recorder = getRecorder({ operation: true, system })
  // fallback to just use system as name
  } else {
    const parsedStatement = new ParsedStatement(system)
    name = transformTemplate(segmentTransformation.name.template, parsedStatement)
    recorder = getRecorder({ operation: false, parsed: parsedStatement, system })
  }

  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction, rule }
}

/**
 * Assigns the appropriate timeslice metrics recorder
 * based on the otel span.
 *
 * @param {object} params to fn
 * @param {ParsedStatement} params.parsed parsed statement of call
 * @param {boolean} params.operation if span is an operation
 * @param {string} params.system `db.system` value of otel span
 * @returns {Function} returns a timeslice metrics recorder function based on span
 */
function getRecorder({ parsed, operation, system }) {
  if (operation) {
    /**
     * this metrics recorder expects to bound with
     * a datastore-shim. But really the only thing it needs
     * is `_metrics` with values for PREFIX and ALL
     * This assigns what it needs to properly create
     * the db operation time slice metrics
     */
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
