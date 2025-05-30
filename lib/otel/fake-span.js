/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * In order to be able to return the appropriate span context
 * within otel bridge. We have to create fake spans for new relic
 * segments.  The only thing needed is a method for `spanContext`
 * which should return the spanId(segment id) and traceId(transaction trace id).
 * We hardcode traceFlags to 1.
 */
module.exports = class FakeSpan {
  constructor(segment, transaction) {
    this.segmentId = segment.id
    this.traceId = transaction.traceId
  }

  spanContext() {
    return {
      spanId: this.segmentId,
      traceId: this.traceId,
      traceFlags: 1
    }
  }
}
