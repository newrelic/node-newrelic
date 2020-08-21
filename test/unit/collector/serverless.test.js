/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const zlib = require('zlib')
const nock = require('nock')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const fs = require('fs')
const helper = require('../../lib/agent_helper')
const API = require('../../../lib/collector/serverless')
const serverfulAPI = require('../../../lib/collector/api')
const path = require('path')

describe('ServerlessCollector API', () => {
  let api = null
  let agent = null

  beforeEach(() => {
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
  })

  afterEach(() => {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  it('has all expected methods shared with the serverful API', () => {
    const serverfulSpecificPublicMethods = new Set([
      'connect',
      'reportSettings'
    ])

    const sharedMethods = Object.keys(serverfulAPI.prototype).filter((key) => {
      return !key.startsWith('_') && !serverfulSpecificPublicMethods.has(key)
    })

    sharedMethods.forEach((method) => {
      expect(API.prototype[method]).to.be.a('function')
    })
  })

  describe('#isConnected', () => {
    it('returns true', () => {
      expect(api.isConnected()).to.equal(true) // tada
    })
  })

  describe('#shutdown', () => {
    it('sets enabled to false', (done) => {
      expect(api.enabled).to.equal(true)
      api.shutdown(() => {
        expect(api.enabled).to.equal(false)
        done()
      })
    })
  })

  describe('#metricData', () => {
    it('adds metric_data to the payload object', (done) => {
      const metricData = {type: 'metric_data'}
      api.metric_data(metricData, () => {
        expect(api.payload.metric_data).to.deep.equal(metricData)
        done()
      })
    })
  })

  describe('#error_data', () => {
    it('adds error_data to the payload object', (done) => {
      const errorData = {type: 'error_data'}
      api.error_data(errorData, () => {
        expect(api.payload.error_data).to.deep.equal(errorData)
        done()
      })
    })
  })

  describe('#transaction_sample_data', () => {
    it('adds transaction_sample_data to the payload object', (done) => {
      const transactionSampleData = {type: 'transaction_sample_data'}
      api.transaction_sample_data(transactionSampleData, () => {
        expect(api.payload.transaction_sample_data).to.deep.equal(transactionSampleData)
        done()
      })
    })
  })

  describe('#flushPayloadSync', () => {
    it('should base64 encode the gzipped payload synchronously', () => {
      const testPayload = {
        someKey: "someValue",
        buyOne: "getOne"
      }
      api.constructor.prototype.payload = testPayload
      const oldDoFlush = api.constructor.prototype._doFlush
      api._doFlush = function testFlush(data) {
        const decoded = JSON.parse(zlib.gunzipSync(Buffer.from(data, 'base64')))
        expect(decoded).to.deep.equal(testPayload)
      }
      api.flushPayloadSync()
      expect(Object.keys(api.payload).length).to.equal(0)
      api.constructor.prototype._doFlush = oldDoFlush
    })
  })

  describe('#analyticsEvents', () => {
    it('adds analytic_event_data to the payload object', (done) => {
      const analyticsEvents = {type: 'analytic_event_data'}
      api.analytic_event_data(analyticsEvents, () => {
        expect(api.payload.analytic_event_data).to.deep.equal(analyticsEvents)
        done()
      })
    })
  })

  describe('#customEvents', () => {
    it('adds custom_event_data to the payload object', (done) => {
      const customEvents = {type: 'custom_event_data'}
      api.custom_event_data(customEvents, () => {
        expect(api.payload.custom_event_data).to.deep.equal(customEvents)
        done()
      })
    })
  })

  describe('#error_event_data', () => {
    it('adds error_event_data to the payload object', (done) => {
      const errorEvents = {type: 'error_event_data'}
      api.error_event_data(errorEvents, () => {
        expect(api.payload.error_event_data).to.deep.equal(errorEvents)
        done()
      })
    })
  })

  describe('#spanEvents', () => {
    it('adds span_event_data to the payload object', (done) => {
      const spanEvents = {type: 'span_event_data'}
      api.span_event_data(spanEvents, () => {
        expect(api.payload.span_event_data).to.deep.equal(spanEvents)
        done()
      })
    })
  })

  describe('#flushPayload', () => {
    let logStub = null

    beforeEach(() => {
      logStub = sinon.stub(process.stdout, 'write').callsFake(() => {
      })
    })

    afterEach(() => {
      logStub.restore()
    })

    it('compresses full payload and writes formatted to stdout', (done) => {
      api.payload = {type: 'test payload'}
      api.flushPayload(() => {
        let logPayload = null

        logPayload = JSON.parse(logStub.args[0][0])

        expect(logPayload).to.be.an('array')
        expect(logPayload[0]).to.be.a('number')

        expect(logPayload[1]).to.equal('NR_LAMBDA_MONITORING')
        expect(logPayload[2]).to.be.a('string')

        done()
      })
    })
    it('handles very large payload and writes formatted to stdout', done => {
      api.payload = {type: 'test payload'}
      for (let i = 0; i < 4096; i++) {
        api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100000)
      }

      api.flushPayload(() => {
        let logPayload = null

        logPayload = JSON.parse(logStub.getCall(0).args[0])

        const buf = Buffer.from(logPayload[2], 'base64')

        zlib.gunzip(buf, (err, unpack) => {
          expect(err).to.be.null
          const payload = JSON.parse(unpack)
          expect(payload.data).to.be.ok
          expect(Object.keys(payload.data)).to.have.lengthOf.above(4000)
          done()
        })
      })
    })
  })
})


describe('ServerlessCollector with output to custom pipe', () => {
  let api = null
  let agent = null
  const customPath = path.resolve('/tmp', 'custom-output')

  before(async function() {
    // create a placeholder file so we can test custom paths
    process.env.NEWRELIC_PIPE_PATH = customPath
    await fs.open(customPath, 'w', (err, fd) => {
      expect(err).to.be.null
      expect(fd).to.be.ok
      return fd
    })
  })

  after(async function() {
    // remove the placeholder file
    await fs.unlink(customPath, (err ) => {
      expect(err).to.be.null
      return
    })
  })

  beforeEach(() => {
    nock.disableNetConnect()
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
  })

  afterEach(() => {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  describe('#flushPayloadToPipe', () => {
    let writeFileSyncStub = null

    beforeEach(() => {
      writeFileSyncStub = sinon.stub(fs, 'writeFileSync').callsFake(() => {})
    })

    afterEach(() => {
      writeFileSyncStub.restore()
    })

    it('compresses full payload and writes formatted to stdout', (done) => {
      api.payload = {type: 'test payload'}
      api.flushPayload(() => {
        const writtenPayload = JSON.parse(writeFileSyncStub.args[0][1])
        expect(writtenPayload).to.be.an('array')
        expect(writtenPayload[0]).to.be.a('number')
        expect(writtenPayload[1]).to.equal('NR_LAMBDA_MONITORING')
        expect(writtenPayload[2]).to.be.a('string')

        done()
      })
    })
    it('handles very large payload and writes formatted to stdout', done => {
      api.payload = {type: 'test payload'}
      for (let i = 0; i < 4096; i++) {
        api.payload[`customMetric${i}`] = Math.floor(Math.random() * 100000)
      }

      api.flushPayload(() => {
        const writtenPayload = JSON.parse(writeFileSyncStub.getCall(0).args[1])
        const buf = Buffer.from(writtenPayload[2], 'base64')

        zlib.gunzip(buf, (err, unpack) => {
          expect(err).to.be.null
          const payload = JSON.parse(unpack)
          expect(payload.data).to.be.ok
          expect(Object.keys(payload.data)).to.have.lengthOf.above(4000)
          done()
        })
      })
    })
  })
})
