/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../metrics/names')
const hashes = require('../util/hashes')

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

/**
 * Helper method for modifying attributes by reference if transaction has CAT metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 * @param {object} configuration Agent configuration options
 */
function addRequiredCATAttributes(transaction, attributes, configuration) {
  attributes['nr.guid'] = transaction.id
  attributes['nr.tripId'] = transaction.tripId || transaction.id
  attributes['nr.pathHash'] = hashes.calculatePathHash(
    configuration.applications()[0],
    transaction.getFullName(),
    transaction.referringPathHash
  )
}

/**
 * Helper method for modifying attributes by reference if transaction has additional CAT metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 * @param {object} configuration Agent configuration options
 */
function maybeAddExtraCATAttributes(transaction, attributes, configuration) {
  if (transaction.referringPathHash) {
    attributes['nr.referringPathHash'] = transaction.referringPathHash
  }

  if (transaction.referringTransactionGuid) {
    const refId = transaction.referringTransactionGuid
    attributes['nr.referringTransactionGuid'] = refId
  }

  const alternatePathHashes = transaction.alternatePathHashes()
  if (alternatePathHashes) {
    attributes['nr.alternatePathHashes'] = alternatePathHashes
  }

  if (transaction.baseSegment && transaction.type === 'web') {
    const apdex =
      configuration.web_transactions_apdex[transaction.getFullName()] || configuration.apdex_t
    const duration = transaction.baseSegment.getDurationInMillis() / 1000
    attributes['nr.apdexPerfZone'] = calculateApdexZone(duration, apdex)
  }
}

/**
 * Helper method for determining a transaction's apdex score based on an apdex threshold and transaction duration
 *
 * @param {number} duration number of seconds the transaction took
 * @param {number} apdexT the apdex threshold
 * @returns {string} String representation of apdex "zone"
 */
function calculateApdexZone(duration, apdexT) {
  if (duration <= apdexT) {
    return 'S' // satisfied
  }

  if (duration <= apdexT * 4) {
    return 'T' // tolerating
  }

  return 'F' // frustrated
}

/**
 * Helper method for modifying attributes by reference if transaction has Synthetics metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
function maybeAddSyntheticAttributes(transaction, attributes) {
  if (transaction.syntheticsData) {
    attributes['nr.syntheticsResourceId'] = transaction.syntheticsData.resourceId
    attributes['nr.syntheticsJobId'] = transaction.syntheticsData.jobId
    attributes['nr.syntheticsMonitorId'] = transaction.syntheticsData.monitorId
  }
}

module.exports = {
  maybeAddQueueAttributes,
  maybeAddExternalAttributes,
  maybeAddDatabaseAttributes,
  maybeAddParentAttributes,
  addRequiredCATAttributes,
  maybeAddExtraCATAttributes,
  maybeAddSyntheticAttributes
}
