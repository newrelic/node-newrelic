/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { EventEmitter } = require('node:events')
const sinon = require('sinon')

const promiseResolvers = require('../lib/promise-resolvers')
const Harvester = require('../../lib/harvester')

class FakeAggregator extends EventEmitter {
  constructor(opts) {
    super()
    this.enabled = opts.enabled
    this.method = opts.method
    this.delay = opts.delay ?? 0
    this.duration = opts.duration ?? 0
  }

  start() {}
  send() {
    this.emit(`finished_data_send-${this.method}`)
  }

  stop() {}

  reconfigure() {}
}

function createAggregator(sandbox, opts) {
  const aggregator = new FakeAggregator(opts)
  sandbox.stub(aggregator, 'start')
  sandbox.stub(aggregator, 'stop')
  sandbox.stub(aggregator, 'reconfigure')
  sandbox.spy(aggregator, 'send')
  return aggregator
}

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const aggregators = [
    createAggregator(sandbox, { enabled: true, method: 'agg1' }),
    createAggregator(sandbox, { enabled: false, method: 'agg2' })
  ]
  const logger = require('./mocks/logger')(sandbox)
  const harvester = new Harvester({ logger })
  aggregators.forEach((a) => harvester.add(a))

  ctx.nr = {
    sandbox,
    aggregators,
    harvester,
    logger
  }
})

test.afterEach((ctx) => {
  ctx.nr.sandbox.restore()
})

test('should have aggregators property', () => {
  const harvester = new Harvester()
  assert.deepStrictEqual(harvester.aggregators, [])
})

test('should add aggregator to this.aggregators', (t) => {
  const { harvester, aggregators } = t.nr
  assert.equal(harvester.aggregators.length, 2, 'should add 2 aggregators')
  assert.deepStrictEqual(harvester.aggregators, aggregators)
})

test('should start all aggregators that are enabled', (t) => {
  const { harvester, aggregators, logger } = t.nr
  harvester.start()
  assert.equal(aggregators[0].start.callCount, 1, 'should start enabled aggregator')
  assert.equal(aggregators[1].start.callCount, 0, 'should not start disabled aggregator')
  assert.equal(logger.debug.callCount, 0)
})

test('should stop all aggregators', (t) => {
  const { harvester, aggregators } = t.nr
  harvester.stop()
  assert.equal(aggregators[0].stop.callCount, 1, 'should stop enabled aggregator')
  assert.equal(aggregators[1].stop.callCount, 1, 'should stop disabled aggregator')
})

test('should reconfigure all aggregators', (t) => {
  const { aggregators, harvester } = t.nr
  const config = { key: 'value' }
  harvester.update(config)
  assert.equal(aggregators[0].reconfigure.callCount, 1, 'should stop enabled aggregator')
  assert.equal(aggregators[1].reconfigure.callCount, 1, 'should stop disabled aggregator')
  assert.deepEqual(aggregators[0].reconfigure.args[0], [config])
})

test('resolve when all data is sent', async (t) => {
  const { promise, resolve } = promiseResolvers()
  const { aggregators, harvester } = t.nr
  await harvester.clear(() => {
    assert.equal(aggregators[0].send.callCount, 1, 'should call send on enabled aggregator')
    assert.equal(aggregators[1].send.callCount, 0, 'should not call send on disabled aggregator')
    resolve()
  })
  await promise
})

test('should delay starting of aggregator when it has a delay property', (t) => {
  const { sandbox, logger } = t.nr
  const clock = sandbox.useFakeTimers()
  const delayAggregator = createAggregator(sandbox, { enabled: true, method: 'test-method', delay: 200 })
  const harvester = new Harvester({ logger })
  harvester.add(delayAggregator)
  harvester.start()
  assert.equal(logger.debug.callCount, 1)
  assert.equal(logger.debug.args[0][0], 'Delay start of test-method by 200 milliseconds')
  const { aggregators } = harvester
  assert.equal(aggregators[0].start.callCount, 0, 'should not start delayed aggregator yet')
  clock.tick(201)
  assert.equal(aggregators[0].start.callCount, 1, 'should start delayed aggregator after delay has elapsed')
})

test('should stop aggregator dynamically when it has a duration property', (t) => {
  const { sandbox, logger } = t.nr
  const clock = sandbox.useFakeTimers()
  const delayAggregator = createAggregator(sandbox, { enabled: true, method: 'test-method', duration: 200 })
  const harvester = new Harvester({ logger })
  harvester.add(delayAggregator)
  harvester.start()
  assert.equal(logger.debug.callCount, 1)
  assert.equal(logger.debug.args[0][0], 'Running test-method for 200 milliseconds')
  const { aggregators } = harvester
  assert.equal(aggregators[0].start.callCount, 1, 'should start aggregator')
  assert.equal(aggregators[0].stop.callCount, 0, 'should not stop aggregator yet')
  clock.tick(201)
  assert.equal(aggregators[0].stop.callCount, 1, 'should stop aggregator after duration has elapsed')
})

test('should delay start and stop aggregator after duration', (t) => {
  const { sandbox, logger } = t.nr
  const clock = sandbox.useFakeTimers()
  const delayAggregator = createAggregator(sandbox, { enabled: true, method: 'test-method', delay: 100, duration: 200 })
  const harvester = new Harvester({ logger })
  harvester.add(delayAggregator)
  harvester.start()
  assert.equal(logger.debug.callCount, 2)
  const { aggregators } = harvester
  assert.equal(aggregators[0].start.callCount, 0, 'should not start delayed aggregator yet')
  assert.equal(aggregators[0].stop.callCount, 0, 'should not stop aggregator yet')
  clock.tick(101)
  assert.equal(aggregators[0].start.callCount, 1, 'should start delayed aggregator after delay has elapsed')
  assert.equal(aggregators[0].stop.callCount, 0, 'should not stop aggregator yet')
  clock.tick(200)
  assert.equal(aggregators[0].stop.callCount, 1, 'should stop aggregator after duration has elapsed')
})
