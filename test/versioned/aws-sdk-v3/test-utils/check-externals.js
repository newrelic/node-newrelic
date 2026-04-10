/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = checkExternals

const assert = require('node:assert')
const checkAWSAttributes = require('./check-aws-attributes.js')
const { match } = require('../../../lib/custom-assertions')

const {
  EXTERN_PATTERN,
  TRANS_SEGMENT
} = require('./constants.js')

/**
 * Used to verify external segments, i.e. segments recorded by an outgoing
 * request, have the correct metadata attached to them.
 *
 * @param {object} params Function parameters.
 * @param {string} params.service Name of the external service being targeted.
 * e.g. "SQS".
 * @param {string[]} params.operations Set of operations that would have been
 * performed against the external service.
 * @param {Transaction} params.tx The current transaction that contains the
 * external segments.
 * @param {Function} params.end Function used to indicate the test has finished.
 *
 * @throws {Error} When the target externals cannot be verified.
 */
function checkExternals({ service, operations, tx, end }) {
  const externals = checkAWSAttributes({
    trace: tx.trace,
    segment: tx.trace.root,
    pattern: EXTERN_PATTERN
  })
  assert.equal(
    externals.length,
    operations.length,
    `should have ${operations.length} aws externals`
  )
  operations.forEach((operation, index) => {
    const attrs = externals[index].attributes.get(TRANS_SEGMENT)
    match(attrs, {
      'aws.operation': operation,
      'aws.requestId': String,
      // in 3.1.0 they fixed service names from lower case
      // see: https://github.com/aws/aws-sdk-js-v3/commit/0011af27a62d0d201296225e2a70276645b3231a
      'aws.service': new RegExp(`${service}|${service.toLowerCase().replace(/ /g, '')}`),
      'aws.region': 'us-east-1'
    })
  })
  end()
}
