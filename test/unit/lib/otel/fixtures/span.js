/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { ROOT_CONTEXT } = require('@opentelemetry/api')

module.exports = function createSpan({ tracer, kind, name }) {
  return tracer.startSpan(name, { kind }, ROOT_CONTEXT)
}
