/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')

const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')
const agent = {
  collector: {},
  metrics: {},
  harvester: { add: sinon.stub() }
}

test('Should only attempt to connect on first start() call', () => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => {
        connectCount++
      }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts, agent)

  streamingSpanAggregator.start()
  assert.equal(connectCount, 1)

  streamingSpanAggregator.start()
  assert.equal(connectCount, 1)
})

test('Should only attempt to disconnect on first stop() call', () => {
  let disconnectCount = 0

  const opts = {
    span_streamer: {
      connect: () => {},
      disconnect: () => {
        disconnectCount++
      }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts, agent)
  streamingSpanAggregator.start()

  streamingSpanAggregator.stop()
  assert.equal(disconnectCount, 1)

  streamingSpanAggregator.stop()
  assert.equal(disconnectCount, 1)
})

test('Should attempt to connect on start() after stop() call', () => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => {
        connectCount++
      },
      disconnect: () => {}
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts, agent)

  streamingSpanAggregator.start()
  streamingSpanAggregator.stop()

  streamingSpanAggregator.start()
  assert.equal(connectCount, 2)
})
