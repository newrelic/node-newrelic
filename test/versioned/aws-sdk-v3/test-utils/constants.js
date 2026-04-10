/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  DESTINATIONS: { TRANS_SEGMENT }
} = require('../../../../lib/config/attribute-filter')

const DATASTORE_PATTERN = /^Datastore/
const EXTERN_PATTERN = /^External\/.*/
const SEGMENT_DESTINATION = TRANS_SEGMENT
const SNS_PATTERN = /^MessageBroker\/SNS\/Topic/
const SQS_PATTERN = /^MessageBroker\/SQS\/Queue/

module.exports = {
  DATASTORE_PATTERN,
  EXTERN_PATTERN,
  TRANS_SEGMENT,
  SEGMENT_DESTINATION,
  SNS_PATTERN,
  SQS_PATTERN
}
