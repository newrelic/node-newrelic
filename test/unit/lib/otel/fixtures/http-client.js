/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_SERVER_ADDRESS,
  ATTR_HTTP_METHOD
} = require('#agentlib/otel/constants.js')

module.exports = function createHttpClientSpan({ parentId, tracer, tx }) {
  const span = createSpan({ name: 'test-span', kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(ATTR_HTTP_METHOD, 'GET')
  span.setAttribute(ATTR_SERVER_ADDRESS, 'newrelic.com')
  return span
}
