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
const { securityPolicies } = require('../../lib/fixtures')
const CollectorApi = require('../../../lib/collector/api')

const RUN_ID = 1337
const SECURITY_POLICIES_TOKEN = 'TEST-TEST-TEST-TEST'
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

test('when high_security: true', async (t) => {
  t.beforeEach(async (ctx) => {
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
    ctx.nr.agent.config.high_security = true

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should send high_security:true in preconnect payload', (t, end) => {
    const { collector, collectorApi } = t.nr
    let handled = false // effectively a `t.plan` (which we don't have in Node 18)
    collector.addHandler(helper.generateCollectorPath('preconnect'), async (req, res) => {
      const body = JSON.parse(await req.body())
      assert.equal(body[0].high_security, true)
      handled = true
      collector.preconnectHandler(req, res)
    })
    collectorApi._login((error) => {
      // Request will only be successful if body matches expected payload.
      assert.equal(error, undefined)
      assert.equal(handled, true)
      end()
    })
  })
})

test('when high_security: false', async (t) => {
  t.beforeEach(async (ctx) => {
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
    ctx.nr.agent.config.high_security = false

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should send high_security:false in preconnect payload', (t, end) => {
    const { collector, collectorApi } = t.nr
    let handled = false // effectively a `t.plan` (which we don't have in Node 18)
    collector.addHandler(helper.generateCollectorPath('preconnect'), async (req, res) => {
      const body = JSON.parse(await req.body())
      assert.equal(body[0].high_security, false)
      handled = true
      collector.preconnectHandler(req, res)
    })
    collectorApi._login((error) => {
      // Request will only be successful if body matches expected payload.
      assert.equal(error, undefined)
      assert.equal(handled, true)
      end()
    })
  })
})

test('in a LASP-enabled agent', async (t) => {
  t.beforeEach(async (ctx) => {
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
    ctx.nr.agent.config.security_policies_token = SECURITY_POLICIES_TOKEN

    ctx.nr.policies = securityPolicies()

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should send token in preconnect payload with high_security:false', (t, end) => {
    // HSM should never be true when LASP/CSP enabled but payload should still be sent.
    const { collector, collectorApi } = t.nr
    let handled = false
    collector.addHandler(helper.generateCollectorPath('preconnect'), async (req, res) => {
      const body = JSON.parse(await req.body())
      assert.equal(body[0].security_policies_token, SECURITY_POLICIES_TOKEN)
      assert.equal(body[0].high_security, false)
      handled = true
      collector.preconnectHandler(req, res)
    })
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      assert.equal(handled, true)
      end()
    })
  })

  await t.test('should fail if preconnect res is missing expected policies', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.shouldShutdownRun(), true)
      assert.equal(collector.isDone('preconnect'), true)
      end()
    })
  })

  await t.test('should fail if agent is missing required property', (t, end) => {
    const { collector, collectorApi } = t.nr
    t.nr.policies.test = { required: true }
    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({
        payload: {
          return_value: {
            redirect_host: `${collector.host}:${collector.port}`,
            security_policies: t.nr.policies
          }
        }
      })
    })
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.shouldShutdownRun(), true)
      assert.equal(collector.isDone('preconnect'), true)
      end()
    })
  })
})

test('should copy request headers', async (t) => {
  const { promise, resolve } = promiseResolvers()
  await beforeEach(t)
  t.after(async () => {
    await afterEach(t)
  })

  const { collector, collectorApi } = t.nr
  const validResponse = {
    agent_run_id: RUN_ID,
    request_headers_map: {
      'X-NR-TEST-HEADER': 'TEST VALUE'
    }
  }
  collector.addHandler(helper.generateCollectorPath('connect', RUN_ID), (req, res) => {
    res.json({ payload: { return_value: validResponse } })
  })

  collectorApi._login(() => {
    assert.equal(collectorApi._reqHeadersMap['X-NR-TEST-HEADER'], 'TEST VALUE')
    resolve()
  })

  await promise
})

test('receiving 200 response, with valid data', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should have a run ID', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.payload.agent_run_id, RUN_ID)
      end()
    })
  })

  await t.test('should pass through server-side configuration untouched', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.payload, { agent_run_id: RUN_ID })
      end()
    })
  })
})

test('receiving 503 response from preconnect', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.writeHead(503)
      res.end()
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should not have gotten an error', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should have passed on the status code', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.status, 503)
      end()
    })
  })
})

test('receiving no hostname from preconnect', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({
        payload: {
          return_value: {
            redirect_host: '',
            security_policies: {}
          }
        }
      })
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should use preexisting collector hostname', (t, end) => {
    const { agent, collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      assert.equal(agent.config.host, '127.0.0.1')
      end()
    })
  })

  await t.test('should pass along server-side configuration from collector', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.payload.agent_run_id, RUN_ID)
      end()
    })
  })
})

test('receiving a weirdo redirect name from preconnect', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({
        payload: {
          return_value: {
            redirect_host: `${collector.host}:chug:${collector.port}`,
            security_policies: {}
          }
        }
      })
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should use preexisting collector hostname and port', (t, end) => {
    const { agent, collector, collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      assert.equal(agent.config.host, collector.host)
      assert.equal(agent.config.port, collector.port)
      end()
    })
  })

  await t.test('should pass along server-side configuration from collector', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.payload.agent_run_id, RUN_ID)
      end()
    })
  })
})

test('receiving no config back from connect', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.json({
        payload: {
          return_value: null
        }
      })
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should have gotten an error', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error.message, 'No agent run ID received from handshake.')
      end()
    })
  })

  await t.test('should pass along no server-side configuration from collector', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error.message, 'No agent run ID received from handshake.')
      assert.equal(res.payload, undefined)
      end()
    })
  })
})

test('receiving 503 response from connect', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.writeHead(503)
      res.end()
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should not have gotten an error', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should have passed on the status code', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.status, 503)
      end()
    })
  })
})

test('receiving 200 response to connect but no data', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.writeHead(200)
      res.end()
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should have gotten an error', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi._login((error) => {
      assert.equal(error.message, 'No agent run ID received from handshake.')
      end()
    })
  })
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
