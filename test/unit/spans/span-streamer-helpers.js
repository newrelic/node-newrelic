/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helpers = module.exports
const { EventEmitter } = require('events')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')

/**
 * A mocked connection object
 *
 * Exists to give tests an EventEmitter
 * compatible object and mock out internal
 * functions so they don't fail
 */
class MockConnection extends EventEmitter {
  /**
   * Called by span streamer's connect method
   *
   * Mocked here to ensure calls to connect don't crash
   */
  setConnectionDetails() {}

  connectSpans() {
    this.stream = helpers.createMockStream()
    this.emit('connected', this.stream)
  }

  disconnect() {
    this.emit('disconnected')
  }

  /* method for testing only */
  setStream(stream) {
    this.stream = stream
  }
}

helpers.createMockStream = function createMockStream() {
  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()
  fakeStream._write = () => true
  return fakeStream
}

/**
 * Creates a fake/mocked connection
 *
 * This is the base fake connection class -- each test
 * may add additional methods to the object as needed.
 */
helpers.createFakeConnection = function createFakeConnection() {
  return new MockConnection()
}

helpers.createMetricAggregator = function createMetricAggregator() {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  return new MetricAggregator(
    {
      // runId: RUN_ID,
      apdexT: 0.5,
      mapper: mapper,
      normalizer: normalizer
    },
    {}
  )
}
