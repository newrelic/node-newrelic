/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DATASTORE_PATTERN = /^Datastore/
const EXTERN_PATTERN = /^External\/.*/
const SNS_PATTERN = /^MessageBroker\/SNS\/Topic/
const SQS_PATTERN = /^MessageBroker\/SQS\/Queue/

const SEGMENT_DESTINATION = 0x20

function checkAWSAttributes(t, segment, pattern, markedSegments = []) {
  const expectedAttrs = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    const attrs = segment.attributes.get(SEGMENT_DESTINATION)
    t.match(attrs, expectedAttrs, 'should have aws attributes')
  }
  segment.children.forEach((child) => {
    checkAWSAttributes(t, child, pattern, markedSegments)
  })

  return markedSegments
}

function getMatchingSegments(t, segment, pattern, markedSegments = []) {
  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
  }

  segment.children.forEach((child) => {
    getMatchingSegments(t, child, pattern, markedSegments)
  })

  return markedSegments
}

function registerCoreInstrumentation(helper) {
  helper.registerInstrumentation({
    moduleName: '@aws-sdk/smithy-client',
    type: 'generic',
    onResolved: require('../../lib/v3/smithy-client')
  })
}

function checkExternals({ t, service, operations, tx }) {
  const externals = checkAWSAttributes(t, tx.trace.root, EXTERN_PATTERN)
  t.equal(externals.length, operations.length, `should have ${operations.length} aws externals`)
  operations.forEach((operation, index) => {
    const attrs = externals[index].attributes.get(SEGMENT_DESTINATION)
    t.match(
      attrs,
      {
        'aws.operation': operation,
        'aws.requestId': String,
        // in 3.1.0 they fixed service names from lower case
        // see: https://github.com/aws/aws-sdk-js-v3/commit/0011af27a62d0d201296225e2a70276645b3231a
        'aws.service': new RegExp(`${service}|${service.toLowerCase().replace(/ /g, '')}`),
        'aws.region': 'us-east-1'
      },
      'should have expected attributes'
    )
  })
  t.end()
}

module.exports = {
  DATASTORE_PATTERN,
  EXTERN_PATTERN,
  SNS_PATTERN,
  SQS_PATTERN,

  SEGMENT_DESTINATION,

  checkAWSAttributes,
  getMatchingSegments,
  registerCoreInstrumentation,
  checkExternals
}
