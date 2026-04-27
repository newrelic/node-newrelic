/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { FIELD_NAME_ATTR, PARENT_TYPE_ATTR, RESOLVE_PREFIX } = require('#agentlib/subscribers/apollo-server/constants.js')

/**
 * Creates metrics for resolver fields when transaction is ended.
 * This will record how long specific resolvers took.
 *
 * @param {object} segment relevant resolver segment
 * @param {string} scope name of transaction
 * @param {Transaction} transaction active transaction
 */
module.exports = function recordResolveSegment(segment, scope, transaction) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis(transaction?.trace)

  const attributes = segment.getAttributes()
  const fieldName = attributes[FIELD_NAME_ATTR]
  const fieldType = attributes[PARENT_TYPE_ATTR]

  // The segment name uses the path to differentiate between duplicate
  // names resolving across different types. Here we use the field name
  // with parent type to compare resolver across usage and transactions.
  if (fieldName && fieldType) {
    const typedFieldMetric = `${RESOLVE_PREFIX}/${fieldType}.${fieldName}`
    createMetricPairs(transaction, typedFieldMetric, scope, duration, exclusive)
  }
}

function createMetricPairs(transaction, name, scope, duration, exclusive) {
  if (scope) {
    transaction.measure(name, scope, duration, exclusive)
  }

  transaction.measure(name, null, duration, exclusive)
}
