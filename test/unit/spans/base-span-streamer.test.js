/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const BaseSpanStreamer = require('../../../lib/spans/base-span-streamer')

tap.test('SpanStreamer', (t) => {
  t.autoend()
  let spanStreamer

  t.beforeEach(() => {
    const fakeConnection = createFakeConnection()

    spanStreamer = new BaseSpanStreamer(
      'fake-license-key',
      fakeConnection,
      createMetricAggregator(),
      2
    )
  })
  ;['addToQueue', 'sendQueue'].forEach((method) => {
    t.test(`should throw error when ${method} is called`, (t) => {
      t.throws(
        () => {
          spanStreamer[method]()
        },
        Error,
        `${method} is not implemented`
      )

      t.end()
    })
  })
})
