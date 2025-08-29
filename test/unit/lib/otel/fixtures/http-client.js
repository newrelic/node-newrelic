/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')
const {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_FULL_URL,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} = require('#agentlib/otel/traces/constants.js')

const defaultAttributes = {
  [ATTR_URL_SCHEME]: 'https',
  [ATTR_SERVER_ADDRESS]: 'www.newrelic.com',
  [ATTR_HTTP_REQUEST_METHOD]: 'GET',
  [ATTR_SERVER_PORT]: 8080,
  [ATTR_URL_PATH]: '/search',
  [ATTR_FULL_URL]: 'https://www.newrelic.com:8080/search?q=test'
}

module.exports = function createHttpClientSpan({ tracer, attributes = defaultAttributes }) {
  const span = createSpan({ name: 'test-span', kind: SpanKind.CLIENT, tracer })
  for (const [key, value] of Object.entries(attributes)) {
    span.setAttribute(key, value)
  }
  return span
}
