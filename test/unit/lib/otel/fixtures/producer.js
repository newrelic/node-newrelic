/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  MessagingDestinationKindValues,
  SEMATTRS_MESSAGING_SYSTEM,
  SEMATTRS_MESSAGING_DESTINATION,
  SEMATTRS_MESSAGING_DESTINATION_KIND
} = require('@opentelemetry/semantic-conventions')
const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

function createTopicProducerSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.PRODUCER, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_MESSAGING_SYSTEM, 'messaging-lib')
  span.setAttribute(SEMATTRS_MESSAGING_DESTINATION_KIND, MessagingDestinationKindValues.TOPIC)
  span.setAttribute(SEMATTRS_MESSAGING_DESTINATION, 'test-topic')
  return span
}

function createQueueProducerSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.PRODUCER, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_MESSAGING_SYSTEM, 'messaging-lib')
  span.setAttribute(SEMATTRS_MESSAGING_DESTINATION_KIND, MessagingDestinationKindValues.QUEUE)
  span.setAttribute(SEMATTRS_MESSAGING_DESTINATION, 'test-queue')
  return span
}

module.exports = {
  createQueueProducerSpan,
  createTopicProducerSpan
}
