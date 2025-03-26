/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_SYSTEM_KIND_VALUES
} = require('#agentlib/otel/constants.js')

function createTopicProducerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.PRODUCER, tracer })
  span.setAttribute(ATTR_MESSAGING_SYSTEM, 'messaging-lib')
  span.setAttribute(ATTR_MESSAGING_DESTINATION_KIND, MESSAGING_SYSTEM_KIND_VALUES.TOPIC)
  span.setAttribute(ATTR_MESSAGING_DESTINATION, 'test-topic')
  return span
}

function createQueueProducerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.PRODUCER, tracer })
  span.setAttribute(ATTR_MESSAGING_SYSTEM, 'messaging-lib')
  span.setAttribute(ATTR_MESSAGING_DESTINATION_KIND, MESSAGING_SYSTEM_KIND_VALUES.QUEUE)
  span.setAttribute(ATTR_MESSAGING_DESTINATION, 'test-queue')
  return span
}

module.exports = {
  createQueueProducerSpan,
  createTopicProducerSpan
}
