/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const Aggregator = require('../../../lib/aggregators/base-aggregator')

const RUN_ID = 1337
const LIMIT = 5
const PERIOD_MS = 5
const METHOD = 'some_method'

test('scheduling', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    ctx.nr.fakeCollectorApi = { send() {} }
    ctx.nr.fakeHarvester = { add() {} }

    ctx.nr.baseAggregator = new Aggregator(
      {
        periodMs: PERIOD_MS,
        runId: RUN_ID,
        limit: LIMIT,
        method: METHOD
      },
      ctx.nr.fakeCollectorApi,
      ctx.nr.fakeHarvester
    )

    ctx.nr.sendInvocation = 0
    ctx.nr.baseAggregator.send = () => {
      ctx.nr.sendInvocation += 1
    }

    ctx.nr.clock = sinon.useFakeTimers()
  })

  t.afterEach((ctx) => {
    ctx.nr.clock.restore()
  })

  await t.test('should consistently invoke send on period', (t) => {
    const { baseAggregator, clock } = t.nr
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 2)
  })

  await t.test('should not schedule multiple timers once started', (t) => {
    const { baseAggregator, clock } = t.nr
    baseAggregator.start()
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 2)
  })

  await t.test('should not stop invoking send on period', (t) => {
    const { baseAggregator, clock } = t.nr
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)

    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)
  })

  await t.test('should stop gracefully handle stop when not started', (t) => {
    const { baseAggregator, clock } = t.nr
    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 0)
  })

  await t.test('should stop gracefully handle stop when already stopped', (t) => {
    const { baseAggregator, clock } = t.nr
    baseAggregator.start()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)

    baseAggregator.stop()
    baseAggregator.stop()

    clock.tick(PERIOD_MS)
    assert.equal(t.nr.sendInvocation, 1)
  })
})

test('send', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    ctx.nr.fakeCollectorApi = { send() {} }
    ctx.nr.fakeHarvester = { add() {} }

    ctx.nr.baseAggregator = new Aggregator(
      {
        periodMs: PERIOD_MS,
        runId: RUN_ID,
        limit: LIMIT,
        method: METHOD
      },
      ctx.nr.fakeCollectorApi,
      ctx.nr.fakeHarvester
    )
  })

  await t.test('should emit proper message with method for starting send', (t) => {
    const { baseAggregator } = t.nr
    baseAggregator._getMergeData = () => null
    baseAggregator._toPayloadSync = () => null
    baseAggregator.clear = () => {}

    const expectedStartEmit = `starting ${METHOD} data send.`
    let emitFired = false
    baseAggregator.once(expectedStartEmit, () => {
      emitFired = true
    })
    baseAggregator.send()
    assert.equal(emitFired, true)
  })

  await t.test('should clear existing data', (t) => {
    const { baseAggregator } = t.nr
    let clearInvocations = 0
    baseAggregator.clear = () => {
      clearInvocations += 1
    }

    // Pretend there's data to clear.
    baseAggregator._getMergeData = () => ['data']
    baseAggregator._toPayloadSync = () => ['data']

    baseAggregator.send()
    assert.equal(clearInvocations, 1)
  })

  await t.test('should call transport w/ correct payload', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}

    const expectedPayload = ['payloadData']
    baseAggregator._getMergeData = () => ['rawData']
    baseAggregator._toPayloadSync = () => expectedPayload

    let invokedPayload = null
    fakeCollectorApi.send = (method, payload) => {
      invokedPayload = payload
    }
    baseAggregator.send()

    assert.deepStrictEqual(invokedPayload, expectedPayload)
  })

  await t.test('should not call transport for no data', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator._getMergeData = () => null
    baseAggregator._toPayloadSync = () => null
    baseAggregator.clear = () => {}

    let transportInvocations = 0
    fakeCollectorApi.send = () => {
      transportInvocations += 1
    }
    baseAggregator.send()

    assert.equal(transportInvocations, 0)
  })

  await t.test('should call merge with original data when transport indicates retain', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']

    let mergeData = null
    baseAggregator._merge = (data) => {
      mergeData = data
    }

    fakeCollectorApi.send = (method, payload, callback) => {
      callback(null, { retainData: true })
    }
    baseAggregator.send()

    assert.deepStrictEqual(mergeData, expectedData)
  })

  await t.test('should not merge when transport indicates not to retain', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations += 1
    }
    fakeCollectorApi.send = (method, payload, callback) => {
      callback(null, { retainData: false })
    }
    baseAggregator.send()

    assert.equal(mergeInvocations, 0)
  })

  await t.test('should default to the sync method in the async case with no override', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayloadSync = () => ['payloadData']
    baseAggregator.isAsync = true

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations += 1
    }
    fakeCollectorApi.send = (method, payload, callback) => {
      callback(null, { retainData: false })
    }
    baseAggregator.send()

    assert.equal(mergeInvocations, 0)
  })

  await t.test('should allow for async payload override', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}

    const expectedData = ['payloadData']
    baseAggregator._getMergeData = () => expectedData
    baseAggregator._toPayload = (cb) => cb(null, ['payloadData'])
    baseAggregator.isAsync = true

    let mergeInvocations = 0
    baseAggregator._merge = () => {
      mergeInvocations += 1
    }
    fakeCollectorApi.send = (method, payload, callback) => {
      callback(null, { retainData: false })
    }
    baseAggregator.send()

    assert.equal(mergeInvocations, 0)
  })

  await t.test('should emit proper message with method for finishing send', (t) => {
    const { baseAggregator, fakeCollectorApi } = t.nr
    baseAggregator.clear = () => {}
    baseAggregator._getMergeData = () => ['data']
    baseAggregator._toPayloadSync = () => ['data']

    const expectedStartEmit = `finished ${METHOD} data send.`
    let emitFired = false
    baseAggregator.once(expectedStartEmit, () => {
      emitFired = true
    })
    fakeCollectorApi.send = (method, payload, callback) => {
      callback(null, { retainData: false })
    }
    baseAggregator.send()

    assert.equal(emitFired, true)
  })
})

test('reconfigure() should update runid and reset enabled flag', () => {
  const fakeCollectorApi = { send() {} }
  const fakeHarvester = { add() {} }
  const fakeConfig = { testing: { enabled: false } }
  const baseAggregator = new Aggregator(
    {
      config: fakeConfig,
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD,
      enabled(config) {
        return config.testing.enabled
      }
    },
    fakeCollectorApi,
    fakeHarvester
  )

  const expectedRunId = 'new run id'
  assert.equal(baseAggregator.enabled, false)

  fakeConfig.run_id = expectedRunId
  fakeConfig.testing.enabled = true
  baseAggregator.reconfigure(fakeConfig)

  assert.equal(baseAggregator.runId, expectedRunId)
  assert.equal(baseAggregator.enabled, true)
})

test('enabled properly', () => {
  let args
  const fakeCollectorApi = { send() {} }
  const fakeHarvester = {
    add(...a) {
      args = a
    }
  }
  const baseAggregator = new Aggregator(
    {
      periodMs: PERIOD_MS,
      runId: RUN_ID,
      limit: LIMIT,
      method: METHOD
    },
    fakeCollectorApi,
    fakeHarvester
  )
  assert.equal(
    baseAggregator.enabled,
    true,
    'should default to enabled when there is no enabled expression'
  )
  assert.equal(args[0], baseAggregator, 'should add aggregator to harvester')
})
