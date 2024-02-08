/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const Harvester = require('../../lib/harvester')
const { EventEmitter } = require('events')
const sinon = require('sinon')

class FakeAggregator extends EventEmitter {
  constructor(opts) {
    super()
    this.enabled = opts.enabled
    this.method = opts.method
  }

  start() {}
  send() {
    this.emit(`finished ${this.method} data send.`)
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

tap.beforeEach((t) => {
  const sandbox = sinon.createSandbox()
  const aggregators = [
    createAggregator(sandbox, { enabled: true, method: 'agg1' }),
    createAggregator(sandbox, { enabled: false, method: 'agg2' })
  ]
  const harvester = new Harvester()
  aggregators.forEach((aggregator) => {
    harvester.add(aggregator)
  })
  t.context.sandbox = sandbox
  t.context.aggregators = aggregators
  t.context.harvester = harvester
})

tap.afterEach((t) => {
  t.context.sandbox.restore()
})

tap.test('Harvester should have aggregators property', (t) => {
  const harvester = new Harvester()
  t.same(harvester.aggregators, [])
  t.end()
})

tap.test('Harvester should add aggregator to this.aggregators', (t) => {
  const { harvester, aggregators } = t.context
  t.ok(harvester.aggregators.length, 2, 'should add 2 aggregators')
  t.same(harvester.aggregators, aggregators)
  t.end()
})

tap.test('Harvester should start all aggregators that are enabled', (t) => {
  const { aggregators, harvester } = t.context
  harvester.start()
  t.equal(aggregators[0].start.callCount, 1, 'should start enabled aggregator')
  t.equal(aggregators[1].start.callCount, 0, 'should not start disabled aggregator')
  t.end()
})

tap.test('Harvester should stop all aggregators', (t) => {
  const { aggregators, harvester } = t.context
  harvester.stop()
  t.equal(aggregators[0].stop.callCount, 1, 'should stop enabled aggregator')
  t.equal(aggregators[1].stop.callCount, 1, 'should stop disabled aggregator')
  t.end()
})

tap.test('Harvester should reconfigure all aggregators', (t) => {
  const { aggregators, harvester } = t.context
  const config = { key: 'value' }
  harvester.update(config)
  t.equal(aggregators[0].reconfigure.callCount, 1, 'should stop enabled aggregator')
  t.equal(aggregators[1].reconfigure.callCount, 1, 'should stop disabled aggregator')
  t.same(aggregators[0].reconfigure.args[0], [config])
  t.end()
})

tap.test('should resolve when all data is sent', (t) => {
  const { aggregators, harvester } = t.context
  harvester.clear(() => {
    t.equal(aggregators[0].send.callCount, 1, 'should call send on enabled aggregator')
    t.equal(aggregators[1].send.callCount, 0, 'should not call send on disabled aggregator')
    t.end()
  })
})
