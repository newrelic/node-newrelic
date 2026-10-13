/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

function createInternalSpan({ tracer, name = 'test-span' }) {
  return createSpan({ name, kind: SpanKind.INTERNAL, tracer })
}

module.exports = {
  createInternalSpan,
}
