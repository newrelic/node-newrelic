/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const _recordMetrics = require('../../lib/metrics/recorders/database')

function ParsedStatement(type, operation, collection, raw) {
  this.type = type
  this.operation = operation
  this.collection = collection
  this.trace = null
  this.raw = ''

  if (typeof raw === 'string') {
    this.trace = new Error().stack
    this.raw = raw
  }
}

ParsedStatement.prototype.recordMetrics = function recordMetrics(segment, scope) {
  _recordMetrics.bind(this)(segment, scope)

  if (this.raw) {
    segment.transaction.agent.queries.add(segment, this.type.toLowerCase(), this.raw, this.trace)
  }
}

module.exports = ParsedStatement
