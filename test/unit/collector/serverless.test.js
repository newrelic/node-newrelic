/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const util = require('util')
const zlib = require('zlib')
const nock = require('nock')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const fs = require('fs')
const fsOpenAsync = util.promisify(fs.open)
const fsUnlinkAsync = util.promisify(fs.unlink)
const helper = require('../../lib/agent_helper')
const API = require('../../../lib/collector/serverless')
const serverfulAPI = require('../../../lib/collector/api')
const path = require('path')

tap.test('ServerlessCollector API', (t) => {
  t.autoend()

  let api = null
  let agent = null

  function beforeTest() {
    nock.disableNetConnect()
    agent = helper.loadMockedAgent({
      serverless_mode: {
        enabled: true
      },
      app_name: ['TEST'],
      license_key: 'license key here'
    })
    agent.reconfigure = () => {}
    agent.setState = () => {}
    api = new API(agent)
  }

  function afterTest() {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  }

  t.test('has all expected methods shared with the serverful API', (t) => {
    const serverfulSpecificPublicMethods = new Set(['connect', 'reportSettings'])

    const sharedMethods = Object.keys(serverfulAPI.prototype).filter((key) => {
      return !key.startsWith('_') && !serverfulSpecificPublicMethods.has(key)
    })

    sharedMethods.forEach((method) => {
      t.type(API.prototype[method], 'function')
    })

    t.end()
  })

  t.test('#isConnected', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('returns true', (t) => {
      t.equal(api.isConnected(), true)
      t.end()
    })
  })

  t.test('#shutdown', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('enabled to false', (t) => {
      t.equal(api.enabled, true)
      api.shutdown(() => {
        t.equal(api.enabled, false)
        t.end()
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

  testMethods.forEach(({ key, name }) => {
    t.test(name, (t) => {
      t.autoend()

      t.beforeEach(beforeTest)
      t.afterEach(afterTest)

      t.test(`adds ${key} to the payload object`, (t) => {
        const eventData = { type: key }
        api[key](eventData, () => {
          t.same(api.payload[key], eventData)
          t.end()
        })
      })

      t.test(`does not add ${key} to the payload object when disabled`, (t) => {
        api.enabled = false
        const eventData = { type: key }
        api[key](eventData, () => {
          t.same(api.payload[key], null)
          t.end()
        })
      })
    })
  })

  t.test('#flushPayloadSync', (t) => {
    t.autoend()

    t.beforeEach(beforeTest)
    t.afterEach(afterTest)

    t.test('should base64 encode the gzipped payload synchronously', (t) => {
      const testPayload = {
        someKey: 'someValue',
        buyOne: 'getOne'
      }
      api.payload = testPayload
      const oldDoFlush = api.constructor.prototype._doFlush
      api._doFlush = function testFlush(data) {
        const decoded = JSON.parse(zlib.gunzipSync(Buffer.from(data, 'base64')))
        t.ok(decoded.metadata)
        t.ok(decoded.data)
        t.same(decoded.data, testPayload)
      }
      api.flushPayloadSync()
      t.equal(Object.keys(api.payload).length, 0)
      api.constructor.prototype._doFlush = oldDoFlush

      t.end()
    })
  })

  t.test('#flushPayload', (t) => {
    t.autoend()

    let stdOutSpy = null

    t.beforeEach(() => {
      // Need to allow output for tap to function correctly
      stdOutSpy = sinon.spy(process.stdout, 'write')

      beforeTest()
    })

    t.afterEach(() => {
      stdOutSpy.restore()

      afterTest()
    })

    t.test('compresses full payload and writes formatted to stdout', (t) => {
      api.payload = { type: 'test payload' }

      api.flushPayload(() => {
        const logPayload = JSON.parse(stdOutSpy.args[0][0])

        t.type(logPayload, Array)
        t.type(logPayload[0], 'number')

        t.equal(logPayload[1], 'NR_LAMBDA_MONITORING')
        t.type(logPayload[2], 'string')

        t.end()
      })
    })

    t.test('handles very large payload and writes formatted to stdout', (t) => {
      api.payload = { type: 'test payload' }
      for (let i = 0; i < 4096; i++) {
        api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100000)
      }

      api.flushPayload(() => {
        let logPayload = null

        logPayload = JSON.parse(stdOutSpy.getCall(0).args[0])

        const buf = Buffer.from(logPayload[2], 'base64')

        zlib.gunzip(buf, (err, unpack) => {
          t.error(err)
          const payload = JSON.parse(unpack)
          t.ok(payload.data)
          t.ok(Object.keys(payload.data).length > 4000)
          t.end()
        })
      })
    })
  })
})

tap.test('ServerlessCollector with output to custom pipe', (t) => {
  t.autoend()

  const customPath = path.resolve('/tmp', 'custom-output')

  let api = null
  let agent = null
  let writeFileSyncStub = null

  t.beforeEach(async () => {
    nock.disableNetConnect()

    process.env.NEWRELIC_PIPE_PATH = customPath
    const fd = await fsOpenAsync(customPath, 'w')
    if (!fd) {
      throw new Error('fd is null')
    }

    agent = helper.loadMockedAgent({
      serverless_mode: {
        enabled: true
      },
      app_name: ['TEST'],
      license_key: 'license key here',
      NEWRELIC_PIPE_PATH: customPath
    })
    agent.reconfigure = () => {}
    agent.setState = () => {}
    api = new API(agent)

    writeFileSyncStub = sinon.stub(fs, 'writeFileSync').callsFake(() => {})
  })

  t.afterEach(async () => {
    nock.enableNetConnect()
    helper.unloadAgent(agent)

    writeFileSyncStub.restore()

    await fsUnlinkAsync(customPath)
  })

  t.test('compresses full payload and writes formatted to stdout', (t) => {
    api.payload = { type: 'test payload' }
    api.flushPayload(() => {
      const writtenPayload = JSON.parse(writeFileSyncStub.args[0][1])

      t.type(writtenPayload, Array)
      t.type(writtenPayload[0], 'number')
      t.equal(writtenPayload[1], 'NR_LAMBDA_MONITORING')
      t.type(writtenPayload[2], 'string')

      t.end()
    })
  })

  t.test('handles very large payload and writes formatted to stdout', (t) => {
    api.payload = { type: 'test payload' }
    for (let i = 0; i < 4096; i++) {
      api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100000)
    }

    api.flushPayload(() => {
      const writtenPayload = JSON.parse(writeFileSyncStub.getCall(0).args[1])
      const buf = Buffer.from(writtenPayload[2], 'base64')

      zlib.gunzip(buf, (err, unpack) => {
        expect(err).to.be.null
        const payload = JSON.parse(unpack)
        t.ok(payload.data)
        t.ok(Object.keys(payload.data).length > 4000, `expected to be > 4000`)
        t.end()
      })
    })
  })
})
