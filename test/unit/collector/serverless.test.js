/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const helper = require('../../lib/agent_helper')

const Collector = require('../../lib/test-collector')
const API = require('../../../lib/collector/serverless')
const serverfulAPI = require('../../../lib/collector/api')

const RUN_ID = 1337

test('ServerlessCollector API', async (t) => {
  async function beforeEach(ctx) {
    ctx.nr = {}

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    const baseAgentConfig = {
      serverless_mode: { enabled: true },
      app_name: ['TEST'],
      license_key: 'license key here'
    }
    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })

    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = () => {}
    ctx.nr.agent.setState = () => {}

    ctx.nr.api = new API(ctx.nr.agent)

    process.env.NEWRELIC_PIPE_PATH = os.devNull
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  }

  await t.test('has all expected methods shared with the serverful API', () => {
    const serverfulSpecificPublicMethods = new Set(['connect', 'reportSettings'])
    const sharedMethods = Object.keys(serverfulAPI.prototype).filter(
      (key) => key.startsWith('_') === false && serverfulSpecificPublicMethods.has(key) === false
    )

    for (const method of sharedMethods) {
      assert.equal(
        typeof API.prototype[method],
        'function',
        `${method} should exist on serverless collector`
      )
    }
  })

  await t.test('#isConnected', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('returns true', (t) => {
      const { api } = t.nr
      assert.equal(api.isConnected(), true)
    })
  })

  await t.test('#shutdown', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('enabled to false', (t, end) => {
      const { api } = t.nr
      api.shutdown(() => {
        assert.equal(api.enabled, false)
        end()
      })
    })
  })

  const testMethods = [
    { key: 'metric_data', name: '#metricData' },
    { key: 'error_data', name: '#errorData' },
    { key: 'transaction_sample_data', name: '#transactionSampleData' },
    { key: 'analytic_event_data', name: '#analyticsEvents' },
    { key: 'custom_event_data', name: '#customEvents' },
    { key: 'error_event_data', name: '#errorEvents' },
    { key: 'sql_trace_data', name: '#sqlTraceEvents' },
    { key: 'span_event_data', name: '#spanEvents' },
    { key: 'log_event_data', name: '#logEvents' }
  ]
  for (const testMethod of testMethods) {
    const { key, name } = testMethod
    await t.test(name, async (t) => {
      t.beforeEach(beforeEach)
      t.afterEach(afterEach)

      await t.test(`adds ${key} to the payload object`, (t) => {
        const { api } = t.nr
        const eventData = { type: key }
        api.send(key, eventData, () => {
          assert.deepStrictEqual(api.payload[key], eventData)
        })
      })

      await t.test(`does not add ${key} to the payload object when disabled`, (t) => {
        const { api } = t.nr
        const eventData = { type: key }
        api.enabled = false
        api.send(key, eventData, () => {
          assert.equal(api.payload[key], null)
        })
      })
    })
  }

  await t.test('#flushPayloadSync', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should base64 encode the gzipped payload synchronously', (t) => {
      const { api } = t.nr
      const testPayload = { someKey: 'someValue', buyOne: 'getOne' }
      api.payload = testPayload

      // const oldDoFlush = api.constructor.prototype._doFlush
      // t.after(() => {
      //   api.constructor.prototype._doFlush = oldDoFlush
      // })

      let flushed = false
      api._doFlush = function testFlush(data) {
        const decoded = JSON.parse(zlib.gunzipSync(Buffer.from(data, 'base64')))
        assert.notEqual(decoded.metadata, undefined)
        assert.notEqual(decoded.data, undefined)
        assert.deepStrictEqual(decoded.data, testPayload)
        flushed = true
      }
      api.flushPayloadSync()
      assert.equal(Object.keys(api.payload).length, 0)
      assert.equal(flushed, true)
    })
  })

  await t.test('#flushPayload', async (t) => {
    t.beforeEach(async (ctx) => {
      await beforeEach(ctx)

      ctx.nr.writeSync = fs.writeFileSync
      ctx.nr.outFile = null
      ctx.nr.outData = null
      fs.writeFileSync = (dest, payload) => {
        ctx.nr.outFile = dest
        ctx.nr.outData = JSON.parse(payload)
        ctx.nr.writeSync(dest, payload)
      }
    })
    t.afterEach((ctx) => {
      afterEach(ctx)
      fs.writeFileSync = ctx.nr.writeSync
    })

    await t.test('compresses full payload and writes formatted to stdout', (t, end) => {
      const { api } = t.nr
      api.payload = { type: 'test payload' }
      api.flushPayload(() => {
        const { outFile, outData } = t.nr
        assert.equal(outFile, '/dev/null')
        assert.equal(Array.isArray(outData), true)
        assert.equal(outData[0], 1)
        assert.equal(outData[1], 'NR_LAMBDA_MONITORING')
        assert.equal(typeof outData[2], 'string')
        end()
      })
    })

    await t.test('handles very large payload and writes formatted to stdout', (t, end) => {
      const { api } = t.nr
      api.payload = { type: 'test payload' }
      for (let i = 0; i < 4096; i += 1) {
        api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100_000)
      }

      api.flushPayload(() => {
        const { outData } = t.nr
        const buf = Buffer.from(outData[2], 'base64')
        zlib.gunzip(buf, (error, unpacked) => {
          assert.equal(error, undefined)
          const payload = JSON.parse(unpacked)
          assert.notEqual(payload.data, undefined)
          assert.equal(Object.keys(payload.data).length > 4000, true)
          end()
        })
      })
    })
  })
})

test('ServerlessCollector with output to custom pipe', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const uniqueId = Math.floor(Math.random() * 100) + '-' + Date.now()
    ctx.nr.destPath = path.join(os.tmpdir(), `custom-output-${uniqueId}`)
    ctx.nr.destFD = await fs.promises.open(ctx.nr.destPath, 'w')
    if (!ctx.nr.destFD) {
      throw Error('fd is null')
    }
    process.env.NEWRELIC_PIPE_PATH = ctx.nr.destPath

    const collector = new Collector({ runId: RUN_ID })
    ctx.nr.collector = collector
    await collector.listen()

    const baseAgentConfig = {
      serverless_mode: { enabled: true },
      app_name: ['TEST'],
      license_key: 'license key here',
      NEWRELIC_PIPE_PATH: ctx.nr.destPath
    }
    const config = Object.assign({}, baseAgentConfig, collector.agentConfig, {
      config: { run_id: RUN_ID }
    })

    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = () => {}
    ctx.nr.agent.setState = () => {}

    ctx.nr.api = new API(ctx.nr.agent)

    ctx.nr.writeSync = fs.writeFileSync
    ctx.nr.outFile = null
    ctx.nr.outData = null
    fs.writeFileSync = (dest, payload) => {
      ctx.nr.outFile = dest
      ctx.nr.outData = JSON.parse(payload)
      ctx.nr.writeSync(dest, payload)
    }
  })

  t.afterEach(async (ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
    fs.writeFileSync = ctx.nr.writeSync
    await fs.promises.unlink(ctx.nr.destPath)
  })

  await t.test('compresses full payload and writes formatted to stdout', (t, end) => {
    const { api } = t.nr
    api.payload = { type: 'test payload' }
    api.flushPayload(() => {
      const { outData } = t.nr
      assert.equal(Array.isArray(outData), true)
      assert.equal(outData[0], 1)
      assert.equal(outData[1], 'NR_LAMBDA_MONITORING')
      assert.equal(typeof outData[2], 'string')
      end()
    })
  })

  await t.test('handles very large payload and writes formatted to stdout', (t, end) => {
    const { api } = t.nr
    for (let i = 0; i < 4096; i += 1) {
      api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100_000)
    }

    api.flushPayload(() => {
      const { outData } = t.nr
      const buf = Buffer.from(outData[2], 'base64')
      zlib.gunzip(buf, (error, unpacked) => {
        assert.equal(error, undefined)
        const payload = JSON.parse(unpacked)
        assert.notEqual(payload.data, undefined)
        assert.equal(Object.keys(payload.data).length > 4000, true, 'expected to be > 4000')
        end()
      })
    })
  })
})
