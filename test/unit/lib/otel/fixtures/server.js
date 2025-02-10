/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_HTTP_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_URL,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM,
} = require('#agentlib/otel/constants.js')

function createRpcServerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.SERVER, tracer })
  span.setAttribute(ATTR_RPC_SYSTEM, 'grpc')
  span.setAttribute(ATTR_RPC_METHOD, 'findUser')
  span.setAttribute(ATTR_RPC_SERVICE, 'TestService')
  return span
}

function createHttpServerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.SERVER, tracer })
  span.setAttribute(ATTR_HTTP_METHOD, 'PUT')
  span.setAttribute(ATTR_HTTP_ROUTE, '/user/:id')
  span.setAttribute(ATTR_HTTP_URL, '/user/1')
  return span
}

function createBaseHttpSpan({ tracer, name = 'test-span' }) {
  return createSpan({ name, kind: SpanKind.SERVER, tracer })
}

module.exports = {
  createBaseHttpSpan,
  createHttpServerSpan,
  createRpcServerSpan
}
