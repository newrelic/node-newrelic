/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')

tap.test('Should only attempt to connect on first start() call', (t) => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => { connectCount++ }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)

  streamingSpanAggregator.start()
  t.equal(connectCount, 1)

  streamingSpanAggregator.start()
  t.equal(connectCount, 1)

  t.end()
})

tap.test('Should only attempt to disconnect on first stop() call', (t) => {
  let disonnectCount = 0

  const opts = {
    span_streamer: {
      connect: () => {},
      disconnect: () => { disonnectCount++ }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)
  streamingSpanAggregator.start()

  streamingSpanAggregator.stop()
  t.equal(disonnectCount, 1)

  streamingSpanAggregator.stop()
  t.equal(disonnectCount, 1)

  t.end()
})

tap.test('Should attempt to connect on start() after stop() call', (t) => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => { connectCount++ },
      disconnect: () => {}
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)

  streamingSpanAggregator.start()
  streamingSpanAggregator.stop()

  streamingSpanAggregator.start()
  t.equal(connectCount, 2)

  t.end()
})
