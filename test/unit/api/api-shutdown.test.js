/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')

test('Agent API - shutdown', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)

    agent.config.attributes.enabled = true
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a shutdown function', (t, end) => {
    const { api } = t.nr
    assert.ok(api.shutdown)
    assert.equal(typeof api.shutdown, 'function')
    end()
  })

  await t.test('calls agent stop', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    mock.expects('stop').once()
    api.shutdown()
    mock.verify()
    end()
  })

  await t.test('accepts callback as second argument', (t, end) => {
    const { agent, api } = t.nr
    agent.stop = function (cb) {
      cb()
    }

    const callback = sinon.spy()
    api.shutdown({}, callback)

    assert.equal(callback.called, true)
    end()
  })

  await t.test('accepts callback as first argument', (t, end) => {
    const { agent, api } = t.nr
    agent.stop = function (cb) {
      cb()
    }

    const callback = sinon.spy()
    api.shutdown(callback)

    assert.equal(callback.called, true)
    end()
  })

  await t.test('does not error when no callback is provided', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.shutdown()
    })
    end()
  })

  await t.test('calls forceHarvestAll when state is `started`', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    agent.setState('started')
    mock.expects('forceHarvestAll').once()
    api.shutdown({ collectPendingData: true })
    mock.verify()

    end()
  })

  await t.test('calls forceHarvestAll when state changes to "started"', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('forceHarvestAll').once()
    api.shutdown({ collectPendingData: true })
    agent.setState('started')
    mock.verify()

    end()
  })

  await t.test('does not call forceHarvestAll when state is not "started"', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('forceHarvestAll').never()
    api.shutdown({ collectPendingData: true })
    mock.verify()

    end()
  })

  await t.test('calls stop when timeout is not given and state changes to "errored"', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('stop').once()
    api.shutdown({ collectPendingData: true })
    agent.setState('errored')
    mock.verify()

    end()
  })

  await t.test('calls stop when timeout is given and state changes to "errored"', (t, end) => {
    const { agent, api } = t.nr
    const clock = sinon.useFakeTimers()
    t.after(() => {
      clock.restore()
    })
    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('stop').once()
    api.shutdown({ collectPendingData: true, timeout: 1000 })
    agent.setState('errored')
    mock.verify()
    clock.tick(1001)

    end()
  })

  await t.test('calls stop when there are no active transactions', (t, end) => {
    const { agent, api } = t.nr
    const mock = sinon.mock(agent)
    agent.setState('started')
    mock.expects('stop').once()
    api.shutdown({ waitForIdle: true })
    mock.verify()

    end()
  })

  await t.test('calls stop after transactions complete when there are some', (t, end) => {
    const { agent, api } = t.nr
    let mock = sinon.mock(agent)
    agent.setState('started')
    mock.expects('stop').never()
    helper.runInTransaction(agent, (tx) => {
      api.shutdown({ waitForIdle: true })
      mock.verify()
      mock.restore()

      mock = sinon.mock(agent)
      mock.expects('stop').once()
      tx.end()
      setImmediate(() => {
        mock.verify()
        end()
      })
    })
  })

  await t.test('calls forceHarvestAll when a timeout is given and not reached', (t, end) => {
    const { agent, api } = t.nr
    const clock = sinon.useFakeTimers()
    t.after(() => {
      clock.restore()
    })
    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('forceHarvestAll').once()
    api.shutdown({ collectPendingData: true, timeout: 1000 })
    agent.setState('started')
    mock.verify()
    clock.tick(1001)

    end()
  })

  await t.test('calls stop when timeout is reached and does not forceHarvestAll', (t, end) => {
    const { agent, api } = t.nr
    const clock = sinon.useFakeTimers()
    t.after(() => {
      clock.restore()
    })
    let didCallForceHarvestAll = false
    agent.forceHarvestAll = function mockedForceHarvest() {
      didCallForceHarvestAll = true
    }

    let stopCallCount = 0
    agent.stop = function mockedStop(cb) {
      stopCallCount++
      // needed to actually trigger code in shutdown.
      // old mock style never got there cause mocked.
      setImmediate(cb)
    }

    agent.setState('starting')

    api.shutdown({ collectPendingData: true, timeout: 1000 }, function sdCallback() {
      assert.ok(!didCallForceHarvestAll)
      assert.equal(stopCallCount, 1)

      end()
    })
    clock.tick(1001)
  })

  await t.test('calls forceHarvestAll when timeout is not a number', (t, end) => {
    const { agent, api } = t.nr
    agent.setState('starting')

    agent.stop = function mockedStop(cb) {
      // needed to actually trigger code in shutdown.
      // old mock style never got there cause mocked.
      setImmediate(cb)
    }

    let forceHarvestCallCount = 0
    agent.forceHarvestAll = function mockedForceHarvest(cb) {
      forceHarvestCallCount++
      setImmediate(cb)
    }

    api.shutdown({ collectPendingData: true, timeout: 'xyz' }, function () {
      assert.equal(forceHarvestCallCount, 1)
      end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })

  await t.test('calls stop after harvest', (t, end) => {
    const { agent, api } = t.nr

    agent.setState('starting')

    let stopCallCount = 0
    agent.stop = function mockedStop(cb) {
      stopCallCount++

      setImmediate(cb)
    }

    agent.forceHarvestAll = function mockedForceHarvest(cb) {
      assert.equal(stopCallCount, 0)
      setImmediate(cb)
    }

    api.shutdown({ collectPendingData: true }, function () {
      assert.equal(stopCallCount, 1)
      end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })

  await t.test('calls stop when harvest errors', (t, end) => {
    const { agent, api } = t.nr

    agent.setState('starting')

    let stopCallCount = 0
    agent.stop = function mockedStop(cb) {
      stopCallCount++

      setImmediate(cb)
    }

    agent.forceHarvestAll = function mockedForceHarvest(cb) {
      assert.equal(stopCallCount, 0)

      setImmediate(() => {
        cb(new Error('some error'))
      })
    }

    api.shutdown({ collectPendingData: true }, function () {
      assert.equal(stopCallCount, 1)
      end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })
})
