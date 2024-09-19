/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { EventEmitter } = require('node:events')
const sinon = require('sinon')

const { match } = require('../lib/custom-assertions')
const promiseResolvers = require('../lib/promise-resolvers')
const Harvester = require('../../lib/harvester')

class FakeAggregator extends EventEmitter {
  constructor(opts) {
    super()
    this.enabled = opts.enabled
    this.method = opts.method
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
  ctx.nr = {}

  const sandbox = sinon.createSandbox()
  const aggregators = [
    createAggregator(sandbox, { enabled: true, method: 'agg1' }),
    createAggregator(sandbox, { enabled: false, method: 'agg2' })
  ]
  const harvester = new Harvester()
  aggregators.forEach((a) => harvester.add(a))

  ctx.nr.sandbox = sandbox
  ctx.nr.aggregators = aggregators
  ctx.nr.harvester = harvester
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
  const { harvester, aggregators } = t.nr
  harvester.start()
  assert.equal(aggregators[0].start.callCount, 1, 'should start enabled aggregator')
  assert.equal(aggregators[1].start.callCount, 0, 'should not start disabled aggregator')
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
  assert.equal(match(aggregators[0].reconfigure.args[0], [config]), true)
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
