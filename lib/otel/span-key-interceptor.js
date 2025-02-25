/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const otelApi = require('@opentelemetry/api')

module.exports = function interceptSpanKey(agent) {
  const fakeCtx = {
    spanKey: null,
    setValue(key) {
      this.spanKey = key
    }
  }

  const fakeSpan = {}
  otelApi.trace.setSpan(fakeCtx, fakeSpan)
  agent.otelSpanKey = fakeCtx.spanKey
}
