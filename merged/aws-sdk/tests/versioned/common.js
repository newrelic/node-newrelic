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

function checkAWSAttributes(t, segment, pattern, markedSegments = [], skipAttrsCheck) {
  const expectedAttrs = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    if (!skipAttrsCheck) {
      const attrs = segment.attributes.get(SEGMENT_DESTINATION)
      t.match(attrs, expectedAttrs, 'should have aws attributes')
    }
  }
  segment.children.forEach((child) => {
    checkAWSAttributes(t, child, pattern, markedSegments, skipAttrsCheck)
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

module.exports = {
  DATASTORE_PATTERN,
  EXTERN_PATTERN,
  SNS_PATTERN,
  SQS_PATTERN,

  SEGMENT_DESTINATION,

  checkAWSAttributes,
  getMatchingSegments
}
