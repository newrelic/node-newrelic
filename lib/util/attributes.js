/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../metrics/names')

/**
 * Helper method for modifying attributes by reference if transaction has queue metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
function maybeAddQueueAttributes(transaction, attributes) {
  const metric = transaction.metrics.getMetric(NAMES.QUEUETIME)

  if (metric) {
    attributes.queueDuration = metric.total
  }
}

/**
 * Helper method for modifying attributes by reference if transaction has external call metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
function maybeAddExternalAttributes(transaction, attributes) {
  const metric = transaction.metrics.getMetric(NAMES.EXTERNAL.ALL)

  if (metric) {
    attributes.externalDuration = metric.total
    attributes.externalCallCount = metric.callCount
  }
}

/**
 * Helper method for modifying attributes by reference if transaction has database metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
function maybeAddDatabaseAttributes(transaction, attributes) {
  const metric = transaction.metrics.getMetric(NAMES.DB.ALL)

  if (metric) {
    attributes.databaseDuration = metric.total
    attributes.databaseCallCount = metric.callCount
  }
}

/**
 * Helper method for modifying attributes by reference if transaction has DT metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
function maybeAddParentAttributes(transaction, attributes) {
  if (transaction.parentSpanId) {
    attributes.parentSpanId = transaction.parentSpanId
  }

  if (transaction.parentId) {
    attributes.parentId = transaction.parentId
  }
}

module.exports = {
  maybeAddQueueAttributes,
  maybeAddExternalAttributes,
  maybeAddDatabaseAttributes,
  maybeAddParentAttributes
}
