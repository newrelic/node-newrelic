/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')

tap.test('Agent API - shutdown', (t) => {
  t.autoend()

  let agent = null
  let api = null

  function setupAgentApi() {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    agent.config.attributes.enabled = true
  }

  function cleanupAgentApi() {
    helper.unloadAgent(agent)
    agent = null
  }

  t.test('exports a shutdown function', (t) => {
    setupAgentApi()
    t.teardown(() => {
      cleanupAgentApi()
    })

    t.ok(api.shutdown)
    t.type(api.shutdown, 'function')

    t.end()
  })

  t.test('calls agent stop', (t) => {
    setupAgentApi()
    t.teardown(() => {
      cleanupAgentApi()
    })

    const mock = sinon.mock(agent)
    mock.expects('stop').once()
    api.shutdown()
    mock.verify()

    t.end()
  })

  t.test('accepts callback as second argument', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    agent.stop = function (cb) {
      cb()
    }

    const callback = sinon.spy()
    api.shutdown({}, callback)

    t.equal(callback.called, true)
    t.end()
  })

  t.test('accepts callback as first argument', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    agent.stop = function (cb) {
      cb()
    }

    const callback = sinon.spy()
    api.shutdown(callback)

    t.equal(callback.called, true)
    t.end()
  })

  t.test('does not error when no callback is provided', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    // should not throw
    api.shutdown()

    t.end()
  })

  t.test('when `options.collectPendingData` is `true`', (t) => {
    t.autoend()

    t.beforeEach(setupAgentApi)
    t.afterEach(cleanupAgentApi)

    t.test('calls forceHarvestAll when state is `started`', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('started')
      mock.expects('forceHarvestAll').once()
      api.shutdown({ collectPendingData: true })
      mock.verify()

      t.end()
    })

    t.test('calls forceHarvestAll when state changes to "started"', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('forceHarvestAll').once()
      api.shutdown({ collectPendingData: true })
      agent.setState('started')
      mock.verify()

      t.end()
    })

    t.test('does not call forceHarvestAll when state is not "started"', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('forceHarvestAll').never()
      api.shutdown({ collectPendingData: true })
      mock.verify()

      t.end()
    })

    t.test('calls stop when timeout is not given and state changes to "errored"', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('stop').once()
      api.shutdown({ collectPendingData: true })
      agent.setState('errored')
      mock.verify()

      t.end()
    })

    t.test('calls stop when timeout is given and state changes to "errored"', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('stop').once()
      api.shutdown({ collectPendingData: true, timeout: 1000 })
      agent.setState('errored')
      mock.verify()

      t.end()
    })
  })

  t.test('when `options.waitForIdle` is `true`', (t) => {
    t.autoend()

    t.beforeEach(setupAgentApi)
    t.afterEach(cleanupAgentApi)

    t.test('calls stop when there are no active transactions', (t) => {
      const mock = sinon.mock(agent)
      agent.setState('started')
      mock.expects('stop').once()
      api.shutdown({ waitForIdle: true })
      mock.verify()

      t.end()
    })

    t.test('calls stop after transactions complete when there are some', (t) => {
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
          t.end()
        })
      })
    })
  })

  t.test('calls forceHarvestAll when a timeout is given and not reached', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    const mock = sinon.mock(agent)
    agent.setState('starting')
    mock.expects('forceHarvestAll').once()
    api.shutdown({ collectPendingData: true, timeout: 1000 })
    agent.setState('started')
    mock.verify()

    t.end()
  })

  t.test('calls stop when timeout is reached and does not forceHarvestAll', (t) => {
    setupAgentApi()

    const originalSetTimeout = setTimeout
    let timeoutHandle = null
    global.setTimeout = function patchedSetTimeout() {
      timeoutHandle = originalSetTimeout.apply(this, arguments)

      // This is a hack to keep tap from shutting down test early.
      // Is there a better way to do this?
      setImmediate(() => {
        timeoutHandle.ref()
      })

      return timeoutHandle
    }

    t.teardown(() => {
      timeoutHandle.unref()
      timeoutHandle = null
      global.setTimeout = originalSetTimeout
      cleanupAgentApi()
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
      t.notOk(didCallForceHarvestAll)
      t.equal(stopCallCount, 1)

      t.end()
    })
  })

  t.test('calls forceHarvestAll when timeout is not a number', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

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
      t.equal(forceHarvestCallCount, 1)
      t.end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })

  t.test('calls stop after harvest', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    agent.setState('starting')

    let stopCallCount = 0
    agent.stop = function mockedStop(cb) {
      stopCallCount++

      setImmediate(cb)
    }

    agent.forceHarvestAll = function mockedForceHarvest(cb) {
      t.equal(stopCallCount, 0)
      setImmediate(cb)
    }

    api.shutdown({ collectPendingData: true }, function () {
      t.equal(stopCallCount, 1)
      t.end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })

  t.test('calls stop when harvest errors', (t) => {
    setupAgentApi()
    t.teardown(cleanupAgentApi)

    agent.setState('starting')

    let stopCallCount = 0
    agent.stop = function mockedStop(cb) {
      stopCallCount++

      setImmediate(cb)
    }

    agent.forceHarvestAll = function mockedForceHarvest(cb) {
      t.equal(stopCallCount, 0)

      setImmediate(() => {
        cb(new Error('some error'))
      })
    }

    api.shutdown({ collectPendingData: true }, function () {
      t.equal(stopCallCount, 1)
      t.end()
    })

    // Waits for agent to start before harvesting and shutting down
    agent.setState('started')
  })
})
