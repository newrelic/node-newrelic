/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { SEMATTRS_HTTP_HOST, SEMATTRS_HTTP_METHOD } = require('@opentelemetry/semantic-conventions')
const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

module.exports = function createHttpClientSpan({ parentId, tracer, tx }) {
  const span = createSpan({ name: 'test-span', kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_HTTP_METHOD, 'GET')
  span.setAttribute(SEMATTRS_HTTP_HOST, 'newrelic.com')
  return span
}
