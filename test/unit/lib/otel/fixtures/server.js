/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_URL,
  SEMATTRS_RPC_SYSTEM,
  SEMATTRS_RPC_SERVICE,
  SEMATTRS_RPC_METHOD
} = require('@opentelemetry/semantic-conventions')

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

function createRpcServerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.SERVER, tracer })
  span.setAttribute(SEMATTRS_RPC_SYSTEM, 'grpc')
  span.setAttribute(SEMATTRS_RPC_METHOD, 'findUser')
  span.setAttribute(SEMATTRS_RPC_SERVICE, 'TestService')
  return span
}

function createHttpServerSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.SERVER, tracer })
  span.setAttribute(SEMATTRS_HTTP_METHOD, 'PUT')
  span.setAttribute(SEMATTRS_HTTP_ROUTE, '/user/:id')
  span.setAttribute(SEMATTRS_HTTP_URL, '/user/1')
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
