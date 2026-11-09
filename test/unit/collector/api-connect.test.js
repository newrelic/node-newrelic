/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const tspl = require('@matteo.collina/tspl')

const HealthReporter = require('#agentlib/health-reporter.js')
const Collector = require('../../lib/test-collector')
const FakeProxyServer = require('../../lib/fake-proxy-server')
const CollectorResponse = require('../../../lib/collector/response')
const helper = require('../../lib/agent_helper')
const { match } = require('#test/assert')
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
            redirect_host: `${collector.host}:${collector.port}`
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
  // A real forward-HTTP-CONNECT proxy that fails the first tunnel attempt
  // with a genuine TLS-layer EPROTO error (simulating a proxy that only
  // accepts plain-HTTP connections), then proxies subsequent tunnels for
  // real. Shared across both sub-tests below because `agents.proxyAgent()`
  // (lib/collector/http-agents.js) is a process-wide singleton: it caches
  // the `HttpsProxyAgent` built from the first test's `proxy_host`/
  // `proxy_port`, so every sub-test must resolve to the same proxy address.
  const proxy = new FakeProxyServer({ failTunnels: 1 })
  await proxy.listen()
  t.after(() => proxy.close())

  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    patchSetTimeout(ctx)
    proxy.resetTunnelCount()
    // `HttpsProxyAgent` does not forward a custom `ca` through the tunnel's
    // TLS-upgrade step, so the successful (post-retry) request can't
    // validate the Collector's self-signed cert any other way. Same
    // precedent as test/unit/collector/remote-method.test.js.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const collector = new Collector({ runId: 31338 })
    await collector.listen()
    ctx.nr.collector = collector

    ctx.nr.agent = helper.loadMockedAgent({
      ...baseAgentConfig,
      ...collector.agentConfig,
      proxy_host: proxy.host,
      proxy_port: String(proxy.port)
    })
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

  t.afterEach((ctx) => {
    restoreTimeout(ctx)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should log warning when proxy is misconfigured', async (t) => {
    const plan = tspl(t, { plan: 8 })
    const { agent, collector, collectorApi } = t.nr

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
      plan.equal(collector.isDone('preconnect'), true)
      plan.equal(collector.isDone('connect'), true)
      plan.equal(res.payload.agent_run_id, 31338)

      const expectErrorMsg = [
        'Your proxy server appears to be configured to accept connections ',
        'over http. When setting `proxy_host` and `proxy_port` New Relic attempts to connect over ',
        'SSL(https). If your proxy is configured to accept connections over http, try setting `proxy` ',
        'to a fully qualified URL(e.g http://proxy-host:8080).'
      ].join('')
      plan.equal(t.nr.logs[0][0].code, 'EPROTO')
      plan.equal(t.nr.logs[0][1], expectErrorMsg)
    })

    await plan.completed
  })

  await t.test(
    'should not log warning when proxy is configured properly but still get EPROTO',
    (t, end) => {
      const { collector, collectorApi } = t.nr
      const { proxy_host: proxyHost, proxy_port: proxyPort } = collectorApi._agent.config
      collectorApi._agent.config.proxy = `http://${proxyHost}:${proxyPort}`
      collectorApi.connect((error, res) => {
        assert.ifError(error)
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
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
    const plan = tspl(t, { plan: 3 })
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
