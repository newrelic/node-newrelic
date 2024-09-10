/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const BaseSpanStreamer = require('../../../lib/spans/base-span-streamer')

test('SpanStreamer', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const fakeConnection = createFakeConnection()

    ctx.nr.spanStreamer = new BaseSpanStreamer(
      'fake-license-key',
      fakeConnection,
      createMetricAggregator(),
      2
    )
  })

  for (const method of ['addToQueue', 'sendQueue']) {
    await t.test(`should throw error when ${method} is called`, (t) => {
      const { spanStreamer } = t.nr
      assert.throws(
        () => {
          spanStreamer[method]()
        },
        Error,
        `${method} is not implemented`
      )
    })
  }
})
