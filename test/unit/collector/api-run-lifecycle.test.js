/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const promiseResolvers = require('../../lib/promise-resolvers')
const Collector = require('../../lib/test-collector')
const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')

const RUN_ID = 1337
const baseAgentConfig = {
  app_name: ['TEST'],
  ssl: true,
  license_key: 'license key here',
  utilization: {
    detect_aws: false,
    detect_pcf: false,
    detect_azure: false,
    detect_gcp: false,
    detect_docker: false
  },
  browser_monitoring: {},
  transaction_tracer: {}
}

test('should bail out if disconnected', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error) => {
    assert.equal(error.message, 'Not connected to collector.')
    resolve()
  })

  await promise
})

test('should discard HTTP 413 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(413)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, false)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should discard HTTP 415 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(415)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, false)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should retain after HTTP 500 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(500)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, true)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should retain after HTTP 503 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(503)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, true)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should indicate a restart and discard data after 401 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(401)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, false)
    assert.equal(cmd.shouldRestartRun(), true)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should indicate a restart and discard data after 409 errors', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(409)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, false)
    assert.equal(cmd.shouldRestartRun(), true)
    assert.equal(collector.isDone('metric_data'), true)
    resolve()
  })

  await promise
})

test('should stop the agent on 410 (force disconnect)', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('shutdown', RUN_ID), (req, res) => {
    res.json({ payload: { return_value: null } })
  })
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(410)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.shouldShutdownRun(), true)
    assert.equal(collector.isDone('metric_data'), true)
    assert.equal(collector.isDone('shutdown'), true)
    assert.equal(agent.config.run_id, null)
    resolve()
  })

  await promise
})

test('should discard unexpected HTTP errors (501)', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
    res.writeHead(501)
    res.end()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error, cmd) => {
    assert.equal(error, undefined)
    assert.equal(cmd.retainData, false)
    resolve()
  })

  await promise
})

test('should handle error in invoked method', async (t) => {
  await beforeEach(t)
  t.after(() => afterEach(t))

  const { agent, collector, collectorApi } = t.nr
  const { promise, resolve } = promiseResolvers()
  collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req) => {
    req.destroy()
  })
  agent.config.run_id = RUN_ID
  collectorApi._runLifecycle(collectorApi._methods.metric_data, null, (error) => {
    assert.equal(error.message, 'socket hang up')
    assert.equal(error.code, 'ECONNRESET')
    resolve()
  })

  await promise
})

async function beforeEach(ctx) {
  ctx.nr = {}

  const collector = new Collector({ runId: RUN_ID })
  ctx.nr.collector = collector
  await collector.listen()

  const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
    config: { run_id: RUN_ID }
  })
  ctx.nr.agent = helper.loadMockedAgent(config)
  ctx.nr.agent.reconfigure = function () {}
  ctx.nr.agent.setState = function () {}

  ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.collector.close()
}
