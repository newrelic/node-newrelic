/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = module.exports

/**
 * Verify we didn't break anything outright and
 * test is setup correctly for functioning calls.
 * @param {object} assert assert library
 * @param {*} result result to check
 * @param {Function} callback callback to call after running assertions
 */
common.checkResult = function checkResult(assert, result, callback) {
  assert.ok(result)

  if (result.errors) {
    result.errors.forEach((error) => {
      assert.ok(!error)
    })
  }

  setImmediate(callback)
}

/**
 * Sub-graph transactions are flagged as ignore via 'createIgnoreTransactionPlugin'
 * to indicate we are not intending to check data for those in these tests.
 * @param {Transaction} transaction handle
 * @returns {boolean} whether or not to skip transaction
 */
common.shouldSkipTransaction = function shouldSkipTransaction(transaction) {
  return !!transaction.forceIgnore
}

/**
 * Creates the root segment based on a prefix and operation part
 * @param {string} operationPart of segment
 * @param {string} prefix of segment
 * @returns {string} formatted string
 */
common.baseSegment = function baseSegment(operationPart, prefix) {
  return `${prefix}//${operationPart}`
}

/**
 * Creates the appropriate sibling hierarchy of segments
 * In apollo 4 they tweaked how the apollo server express instance is constructed.
 * It lacks a / router and routes everything through a global middleware
 * @param {string} firstSegmentName name
 * @param {Array} operationSegments list of operation names
 * @returns {Array} expected segment tree
 */
common.constructSegments = function constructSegments(firstSegmentName, operationSegments) {
  return [firstSegmentName, [...operationSegments]]
}

/**
 * Creates the tree of operation segments. If this is using apollo-express or apollo server < 5
 * it adds an express middleware handler
 * @param {object} testContext context for test
 * @param {Array} operationSegments operation segments
 * @returns {Array} array of segments
 */
common.constructOperationSegments = function constructOperationSegments(
  testContext,
  operationSegments
) {
  const { TRANSACTION_PREFIX: prefix } = testContext
  if (prefix.includes('Nodejs')) {
    return operationSegments
  }

  return ['Nodejs/Middleware/Expressjs/<anonymous>', operationSegments]
}
