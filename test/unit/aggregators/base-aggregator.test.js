/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'


const tap = require('tap')
const sinon = require('sinon')
const Aggregator = require('../../../lib/aggregators/base-aggregator')

const RUN_ID = 1337
const LIMIT = 5
const PERIOD_MS = 5
const METHOD = 'some_method'

tap.test('scheduling', (t) => {
  t.autoend()

  let baseAggregator = null
  let fakeCollectorApi = null
  let sendInvocation = 0
  let clock = null

  t.beforeEach((done) => {
    fakeCollectorApi = {}
    fakeCollectorApi[METHOD] = () => {}

    baseAggregator = new Aggregator({
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD
    }, fakeCollectorApi)

    // Keep track of send invocations, avoiding rest of functionality
    sendInvocation = 0
    baseAggregator.send = () => sendInvocation++

    clock = sinon.useFakeTimers()

    done()
  })

  t.afterEach((done) => {
    baseAggregator = null
    fakeCollectorApi = null

    clock.restore()
    clock = null

    sendInvocation = 0

    done()
  })

  t.test('should consistently invoke send on period', (t) => {
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 2)

    t.end()
  })

  t.test('should not schedule multiple timers once started', (t) => {
    baseAggregator.start()
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 2)

    t.end()
  })

  t.test('should stop invoking send on period', (t) => {
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    t.end()
  })

  t.test('should stop gracefully handle stop when not started', (t) => {
    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 0)

    t.end()
  })

  t.test('should stop gracefully handle stop when already stopped', (t) => {
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    baseAggregator.stop()
    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    t.equal(sendInvocation, 1)

    t.end()
  })
})

tap.test('send', (t) => {
  t.autoend()

  let baseAggregator = null
  let fakeCollectorApi = null

  t.beforeEach((done) => {
    fakeCollectorApi = {}
    fakeCollectorApi[METHOD] = () => {}

    baseAggregator = new Aggregator({
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD
    }, fakeCollectorApi)

    done()
  })

  t.afterEach((done) => {
    baseAggregator = null
    fakeCollectorApi = null

    done()
  })

  t.test('should emit proper message with method for starting send', (t) => {
    baseAggregator._getMergeData = () => null
    baseAggregator._toPayloadSync = () => null
    baseAggregator.clear = () => {}

    const expectedStartEmit = `starting ${METHOD} data send.`

    let emitFired = false
    baseAggregator.once(expectedStartEmit, () => {
      emitFired = true
    })

    baseAggregator.send()

    t.ok(emitFired)

    t.end()
  })

  t.test('should clear existing data', (t) => {
    // Keep track of clear invocations
    let clearInvocations = 0
    baseAggregator.clear = () => clearInvocations++

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => ['data']
    baseAggregator._toPayloadSync = () => ['data']

    baseAggregator.send()

    t.equal(clearInvocations, 1)

    t.end()
  })

  t.test('should call transport w/ correct payload', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}

    const expectedPayload = ['payloadData']

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => ['rawData']
    baseAggregator._toPayloadSync = () => expectedPayload

    let invokedPayload = null

    fakeCollectorApi[METHOD] = (payload) => {
      invokedPayload = payload
    }

    baseAggregator.send()

    t.deepEqual(invokedPayload, expectedPayload)

    t.end()
  })

  t.test('should not call transport for no data', (t) => {
    // Pretend there's data to clear
    baseAggregator._getMergeData = () => null
    baseAggregator._toPayloadSync = () => null
    baseAggregator.clear = () => {}

    let transportInvocations = 0
    fakeCollectorApi[METHOD] = () => {
      transportInvocations++
    }

    baseAggregator.send()

    t.equal(transportInvocations, 0)

    t.end()
  })

  t.test('should call merge with original data when transport indicates retain', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']

    let mergeData = null
    baseAggregator._merge = (data) => {
      mergeData = data
    }

    fakeCollectorApi[METHOD] = (payload, callback) => {
      callback(null, { retainData: true})
    }

    baseAggregator.send()

    t.deepEqual(mergeData, expectedData)

    t.end()
  })

  t.test('should not merge when transport indicates not to retain', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations++
    }

    fakeCollectorApi[METHOD] = (payload, callback) => {
      callback(null, { retainData: false})
    }

    baseAggregator.send()

    t.equal(mergeInvocations, 0)

    t.end()
  })

  t.test('should default to the sync method in the async case with no override', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']

    // Set the aggregator up as async
    baseAggregator.isAsync = true

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations++
    }

    fakeCollectorApi[METHOD] = (payload, callback) => {
      callback(null, { retainData: false})
    }

    baseAggregator.send()

    t.equal(mergeInvocations, 0)

    t.end()
  })

  t.test('should allow for async payload override', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']

    // Pretend there's data to clear
    baseAggregator._getMergeData = () => expectedData
    baseAggregator.toPayload = (cb) => cb(null, ['payloadData'])

    // Set the aggregator up as async
    baseAggregator.isAsync = true

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations++
    }

    fakeCollectorApi[METHOD] = (payload, callback) => {
      callback(null, { retainData: false})
    }

    baseAggregator.send()

    t.equal(mergeInvocations, 0)

    t.end()
  })

  t.test('should emit proper message with method for finishing send', (t) => {
    // stub to allow invocation
    baseAggregator.clear = () => {}
    baseAggregator._getMergeData = () => ['data']
    baseAggregator._toPayloadSync = () => ['data']

    const expectedStartEmit = `finished ${METHOD} data send.`

    let emitFired = false
    baseAggregator.once(expectedStartEmit, () => {
      emitFired = true
    })

    fakeCollectorApi[METHOD] = (payload, callback) => {
      callback(null, { retainData: false})
    }

    baseAggregator.send()

    t.ok(emitFired)

    t.end()
  })
})

tap.test('reconfigure() should update runid', (t) => {
  t.autoend()

  let baseAggregator = null
  let fakeCollectorApi = null

  t.beforeEach((done) => {
    fakeCollectorApi = {}
    fakeCollectorApi[METHOD] = () => {}

    baseAggregator = new Aggregator({
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD
    }, fakeCollectorApi)

    done()
  })

  t.afterEach((done) => {
    baseAggregator = null
    fakeCollectorApi = null

    done()
  })

  t.test('reconfigure() should update runid', (t) => {
    const expectedRunId = 'new run id'
    const fakeConfig = {run_id: expectedRunId}

    baseAggregator.reconfigure(fakeConfig)

    t.equal(baseAggregator.runId, expectedRunId)

    t.end()
  })
})
