/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_SYSTEM,
  ATTR_MESSAGING_OPERATION,
} = require('#agentlib/otel/constants.js')

function createConsumerSpan({ tracer, name = 'test-span', spanContext }) {
  const span = createSpan({ name, kind: SpanKind.CONSUMER, tracer, spanContext })
  span.setAttribute(ATTR_MESSAGING_SYSTEM, 'messaging-lib')
  span.setAttribute(ATTR_MESSAGING_OPERATION, 'send')
  span.setAttribute(ATTR_MESSAGING_DESTINATION_NAME, 'test-topic')
  return span
}

module.exports = {
  createConsumerSpan
}
