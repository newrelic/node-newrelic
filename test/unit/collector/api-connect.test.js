/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const nock = require('nock')
const proxyquire = require('proxyquire')
const tspl = require('@matteo.collina/tspl')

const HealthReporter = require('#agentlib/health-reporter.js')
const Collector = require('../../lib/test-collector')
const CollectorResponse = require('../../../lib/collector/response')
const helper = require('../../lib/agent_helper')
const { match } = require('#test/assert')
const { securityPolicies } = require('../../lib/fixtures')
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

test('requires a callback', (t) => {
  const agent = helper.loadMockedAgent(baseAgentConfig)
  agent.reconfigure = () => {}
  agent.setState = () => {}
  t.after(() => {
    helper.unloadAgent(agent)
  })

  const collectorApi = new CollectorApi(agent)
  assert.throws(
    () => {
      collectorApi.connect(null)
    },
    { message: 'callback is required' }
  )
})

test('receiving 200 response, with valid data', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should pass through server-side configuration untouched', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.payload, { agent_run_id: RUN_ID })
      end()
    })
  })
})

test('succeeds when given a different port number for redirect', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should have the correct hostname', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect(() => {
      const methods = collectorApi._methods
      Object.keys(methods)
        .filter((key) => key !== 'preconnect')
        .forEach((key) => {
          assert.equal(methods[key].endpoint.host, collector.host)
        })
      end()
    })
  })

  await t.test('should not change config host', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect(() => {
      assert.equal(collectorApi._agent.config.host, collector.host)
      end()
    })
  })

  await t.test('should update endpoints with correct port number', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect(() => {
      const methods = collectorApi._methods
      Object.keys(methods)
        .filter((key) => key !== 'preconnect')
        .forEach((key) => {
          assert.equal(methods[key].endpoint.port, collector.port)
        })
      end()
    })
  })

  await t.test('should not update preconnect endpoint', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect(() => {
      assert.equal(collectorApi._methods.preconnect.endpoint.host, collector.host)
      assert.equal(collectorApi._methods.preconnect.endpoint.port, collector.port)
      end()
    })
  })

  await t.test('should not change config port number', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect(() => {
      assert.equal(collectorApi._agent.config.port, collector.port)
      end()
    })
  })

  await t.test('should have a run ID', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.ifError(error)
      assert.equal(res.payload.agent_run_id, RUN_ID)
      end()
    })
  })

  await t.test('should pass through server-side configuration untouched', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.ifError(error)
      assert.deepStrictEqual(res.payload, { agent_run_id: RUN_ID })
      end()
    })
  })
})

const retryCounts = [1, 5]
for (const retryCount of retryCounts) {
  test(`retry count: ${retryCount}`, async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}

      patchSetTimeout(ctx)

      const collector = new Collector({ runId: RUN_ID })
      ctx.nr.collector = collector
      await collector.listen()

      let retries = 0
      collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
        if (retries < retryCount) {
          retries += 1
          res.writeHead(503)
          res.end()
          return
        }
        res.json({
          return_value: {
            redirect_host: `${collector.host}:${collector.port}`,
            security_policies: {}
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

    t.afterEach((ctx) => {
      restoreTimeout(ctx)
      helper.unloadAgent(ctx.nr.agent)
      ctx.nr.collector.close()
    })

    await t.test('should not error out', (t, end) => {
      const { collectorApi } = t.nr
      collectorApi.connect((error) => {
        assert.ifError(error)
        assert.equal(error, undefined)
        end()
      })
    })

    await t.test('should have a run ID', (t, end) => {
      const { collectorApi } = t.nr
      collectorApi.connect((error, res) => {
        assert.ifError(error)
        assert.equal(res.payload.agent_run_id, RUN_ID)
        end()
      })
    })

    await t.test('should pass through server-side configuration untouched', (t, end) => {
      const { collectorApi } = t.nr
      collectorApi.connect((error, res) => {
        assert.ifError(error)
        assert.deepStrictEqual(res.payload, { agent_run_id: RUN_ID })
        end()
      })
    })
  })
}

test('disconnects on force disconnect (410)', async (t) => {
  const exception = {
    exception: {
      message: 'fake force disconnect',
      error_type: 'NewRelic::Agent::ForceDisconnectException'
    }
  }

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({ code: 410, payload: exception })
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

  await t.test('should not have errored', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect((error) => {
      assert.equal(error, undefined)
      assert.equal(collector.isDone('preconnect'), true)
      end()
    })
  })

  await t.test('should not have a response body', (t, end) => {
    const { collector, collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.ifError(error)
      assert.equal(res.payload, undefined)
      assert.equal(collector.isDone('preconnect'), true)
      end()
    })
  })

  await t.test('should update health status', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent, collector, collectorApi } = t.nr

    agent.healthReporter.setStatus = (status) => {
      plan.equal(status, HealthReporter.STATUS_FORCED_DISCONNECT)
    }

    collectorApi.connect((error) => {
      plan.equal(error, undefined)
      plan.equal(collector.isDone('preconnect'), true)
    })

    await plan.completed
  })
})

test('retries preconnect until forced to disconnect (410)', async (t) => {
  const retryCount = 500
  const exception = {
    exception: {
      message: 'fake force disconnect',
      error_type: 'NewRelic::Agent::ForceDisconnectException'
    }
  }

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    patchSetTimeout(ctx)

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    let retries = 0
    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      if (retries < retryCount) {
        retries += 1
        res.writeHead(503)
        res.end()
        return
      }
      res.json({ code: 410, payload: exception })
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    restoreTimeout(ctx)
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should have received shutdown response', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.ifError(error)
      const shutdownCommand = CollectorResponse.AGENT_RUN_BEHAVIOR.SHUTDOWN
      assert.deepStrictEqual(res.agentRun, shutdownCommand)
      end()
    })
  })
})

test('retries on receiving invalid license key (401)', async (t) => {
  const retryCount = 5

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    patchSetTimeout(ctx)

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    let retries = 0
    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      if (retries < retryCount) {
        retries += 1
        res.writeHead(401)
        res.end()
        return
      }
      ctx.nr.retries = retries
      res.json({
        return_value: {}
      })
    })
    // We specify RUN_ID in the path so that we replace the existing connect
    // handler with one that returns our unique run id.
    collector.addHandler(helper.generateCollectorPath('connect', RUN_ID), (req, res) => {
      res.json({ payload: { return_value: { agent_run_id: 31338 } } })
    })

    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    restoreTimeout(ctx)
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should call the expected number of times', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.ifError(error)
      assert.equal(t.nr.retries, 5)
      assert.equal(res.payload.agent_run_id, 31338)
      end()
    })
  })

  await t.test('should update health status', async (t) => {
    const plan = tspl(t, { plan: 6 })
    const { agent, collectorApi } = t.nr

    let invocation = 0
    agent.healthReporter.setStatus = (status) => {
      invocation += 1
      if (invocation < 6) {
        plan.equal(status, HealthReporter.STATUS_INVALID_LICENSE_KEY)
      } else {
        // After 5 retries, we get a success.
        plan.equal(status, HealthReporter.STATUS_HEALTHY)
      }
    }

    collectorApi.connect(() => {})

    await plan.completed
  })
})

test('retries on misconfigured proxy', async (t) => {
  // We are using `nock` for these tests because it provides its own socket
  // implementation that is able to fake a bad connection to a server.
  // Basically, these tests are attempting to verify conditions around
  // establishing connections to a proxy server, and we need to be able to
  // simulate those connections not establishing correctly. The best we can
  // do with our in-process HTTP server is to generate an abruptly closed
  // request, but that will not meet the "is misconfigured proxy" assertion
  // the agent uses. We'd like a better way of dealing with this, but for now
  // (2024-08), we are moving on so that this does not block our test conversion
  // to `node:test`.
  //
  // See https://github.com/nock/nock/blob/66eb7f48a7bdf50ee79face6403326b02d23253b/lib/socket.js#L81-L88.
  // That `destroy` method is what ends up implementing the functionality
  // behind `nock.replyWithError`.

  const expectedError = { code: 'EPROTO' }

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    patchSetTimeout(ctx)
    nock.disableNetConnect()

    ctx.nr.agent = helper.loadMockedAgent({
      host: 'collector.newrelic.com',
      port: 443,
      ...baseAgentConfig
    })
    ctx.nr.agent.reconfigure = function () {}
    ctx.nr.agent.setState = function () {}
    ctx.nr.agent.config.proxy_port = '8080'
    ctx.nr.agent.config.proxy_host = 'test-proxy-server'

    const baseURL = 'https://collector.newrelic.com'
    const preconnectURL = helper.generateCollectorPath('preconnect')
    ctx.nr.failure = nock(baseURL).post(preconnectURL).times(1).replyWithError(expectedError)
    ctx.nr.success = nock(baseURL).post(preconnectURL).reply(200, { return_value: {} })
    ctx.nr.connect = nock(baseURL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, { return_value: { agent_run_id: 31338 } })

    ctx.nr.logs = []
    const CAPI = proxyquire('../../../lib/collector/api', {
      '../logger': {
        child() {
          return this
        },
        debug() {},
        error() {},
        info() {},
        warn(...args) {
          ctx.nr.logs.push(args)
        },
        trace() {}
      }
    })
    ctx.nr.collectorApi = new CAPI(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    restoreTimeout(ctx)
    helper.unloadAgent(ctx.nr.agent)
    nock.enableNetConnect()
  })

  await t.test('should log warning when proxy is misconfigured', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, collectorApi } = t.nr

    let invocation = 0
    agent.healthReporter.setStatus = (status) => {
      invocation += 1
      if (invocation === 1) {
        plan.equal(status, HealthReporter.STATUS_HTTP_PROXY_MISCONFIGURED)
      } else {
        plan.equal(status, HealthReporter.STATUS_HEALTHY)
      }
    }

    collectorApi.connect((error, res) => {
      plan.ifError(error)
      plan.equal(t.nr.failure.isDone(), true)
      plan.equal(t.nr.success.isDone(), true)
      plan.equal(t.nr.connect.isDone(), true)
      plan.equal(res.payload.agent_run_id, 31338)

      const expectErrorMsg = [
        'Your proxy server appears to be configured to accept connections ',
        'over http. When setting `proxy_host` and `proxy_port` New Relic attempts to connect over ',
        'SSL(https). If your proxy is configured to accept connections over http, try setting `proxy` ',
        'to a fully qualified URL(e.g http://proxy-host:8080).'
      ].join('')
      plan.deepStrictEqual(
        t.nr.logs,
        [[expectedError, expectErrorMsg]],
        'Proxy misconfigured message correct'
      )
    })

    await plan.completed
  })

  await t.test(
    'should not log warning when proxy is configured properly but still get EPROTO',
    (t, end) => {
      const { collectorApi } = t.nr
      collectorApi._agent.config.proxy = 'http://test-proxy-server:8080'
      collectorApi.connect((error, res) => {
        assert.ifError(error)
        assert.equal(t.nr.failure.isDone(), true)
        assert.equal(t.nr.success.isDone(), true)
        assert.equal(t.nr.connect.isDone(), true)
        assert.equal(res.payload.agent_run_id, 31338)

        match(
          t.nr.logs,
          [[{ code: 'EPROTO' }, 'Unexpected error communicating with New Relic backend.']]
        )

        end()
      })
    }
  )
})

test('non-specific error statuses', async (t) => {
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

    ctx.nr.logs = []
    const CAPI = proxyquire('../../../lib/collector/api', {
      '../logger': {
        child() {
          return this
        },
        debug() {},
        error() {},
        info() {},
        warn(...args) {
          ctx.nr.logs.push(args)
        },
        trace() {}
      }
    })

    ctx.nr.collectorApi = new CAPI(ctx.nr.agent)
  })

  t.afterEach(afterEach)

  await t.test('should update health status for responses with status code', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, collector, collectorApi } = t.nr

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({ code: 418, payload: 'bad stuff' })
    })

    agent.healthReporter.setStatus = (status) => {
      plan.equal(status, HealthReporter.STATUS_BACKEND_ERROR)
      match(
        t.nr.logs,
        [[null, 'Received error status code from New Relic backend: 418.']],
        { assert: plan }
      )
    }

    collectorApi.connect(() => {})

    await plan.completed
  })

  await t.test('should update health status for responses without status code', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent, collector, collectorApi } = t.nr

    collector.addHandler(helper.generateCollectorPath('preconnect'), (req) => {
      req.destroy()
    })

    agent.healthReporter.setStatus = (status) => {
      plan.equal(status, HealthReporter.STATUS_BACKEND_ERROR)
      plan.match(t.nr.logs[0][0].message, /socket hang up/)
      plan.equal(t.nr.logs[0][1], 'Unexpected error communicating with New Relic backend.')
    }

    collectorApi.connect(() => {})

    await plan.completed
  })
})

test('in a LASP/CSP enabled agent', async (t) => {
  const SECURITY_POLICIES_TOKEN = 'TEST-TEST-TEST-TEST'

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

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
    ctx.nr.policies = securityPolicies()

    ctx.nr.validResponse = { agent_run_id: RUN_ID, security_policies: ctx.nr.policies }
    collector.addHandler(helper.generateCollectorPath('preconnect'), (req, res) => {
      res.json({
        payload: {
          return_value: {
            redirect_host: `https://${collector.host}:${collector.port}`,
            security_policies: ctx.nr.policies
          }
        }
      })
    })
    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.json({ payload: { return_value: ctx.nr.validResponse } })
    })
  })

  t.afterEach(afterEach)

  await t.test('should include security policies in api callback response', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.connect((error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.payload, t.nr.validResponse)
      end()
    })
  })

  await t.test('drops data collected before connect when policies are update', (t, end) => {
    const { agent, collectorApi } = t.nr
    agent.config.api.custom_events_enabled = true
    agent.customEventAggregator.add(['will be overwritten'])
    assert.equal(agent.customEventAggregator.length, 1)
    collectorApi.connect((error, res) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(res.payload, t.nr.validResponse)
      assert.equal(agent.customEventAggregator.length, 0)
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

function patchSetTimeout(ctx) {
  ctx.nr.setTimeout = global.setTimeout
  global.setTimeout = function (cb) {
    const nodeTimeout = ctx.nr.setTimeout(cb, 0)

    // This is a hack to keep the test runner from reaping the test before
    // the retries are complete. Is there a better way to do this?
    setImmediate(() => {
      nodeTimeout.ref()
    })
    return nodeTimeout
  }
}

function restoreTimeout(ctx) {
  global.setTimeout = ctx.nr.setTimeout
}
