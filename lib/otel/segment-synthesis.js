/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { RulesEngine } = require('./rules')
const defaultLogger = require('../logger').child({ component: 'segment-synthesizer' })
const NAMES = require('../metrics/names')
const {
  SEMATTRS_HTTP_HOST,
  SEMATTRS_DB_MONGODB_COLLECTION,
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_SQL_TABLE,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_STATEMENT,
  DbSystemValues
} = require('@opentelemetry/semantic-conventions')
const parseSql = require('../db/query-parsers/sql')

class SegmentSynthesizer {
  constructor(agent, { logger = defaultLogger } = {}) {
    this.agent = agent
    this.logger = logger
    this.engine = new RulesEngine()
  }

  synthesize(otelSpan) {
    const rule = this.engine.test(otelSpan)
    if (!rule?.type) {
      this.logger.debug(
        'Cannot match a rule to span name: %s, kind %s',
        otelSpan?.name,
        otelSpan?.kind
      )
      return
    }

    if (rule.type === 'external') {
      return this.createExternalSegment(otelSpan)
    } else if (rule.type === 'db') {
      return this.createDatabaseSegment(otelSpan)
    }

    this.logger.debug('Found type: %s, no synthesis rule currently built', rule.type)
  }

  // TODO: should we move these to somewhere else and use in the places
  // where external segments are created in our agent
  createExternalSegment(otelSpan) {
    const context = this.agent.tracer.getContext()
    const host = otelSpan.attributes[SEMATTRS_HTTP_HOST] || 'Unknown'
    const name = NAMES.EXTERNAL.PREFIX + host
    return this.agent.tracer.createSegment({
      name,
      parent: context.segment,
      transaction: context.transaction
    })
  }

  parseStatement(otelSpan, system) {
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

  // TODO: This probably has some holes
  // I did analysis and tried to apply the best logic
  // to extract table/operation
  createDatabaseSegment(otelSpan) {
    const context = this.agent.tracer.getContext()
    const system = otelSpan.attributes[SEMATTRS_DB_SYSTEM]
    const { operation, table } = this.parseStatement(otelSpan, system)

    let name = `Datastore/statement/${system}/${table}/${operation}`
    // All segment name shapes are same except redis/memcached
    if (system === DbSystemValues.REDIS || system === DbSystemValues.MEMCACHED) {
      name = `Datastore/operation/${system}/${operation}`
    }
    return this.agent.tracer.createSegment({
      name,
      parent: context.segment,
      transaction: context.transaction
    })
  }
}

module.exports = SegmentSynthesizer
