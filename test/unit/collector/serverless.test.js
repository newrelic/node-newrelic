'use strict'
const zlib = require('zlib')
const nock = require('nock')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const API = require('../../../lib/collector/serverless')
const serverfulAPI = require('../../../lib/collector/api')

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
      api.metricData(metricData, () => {
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

  describe('#populateDataSync', () => {
    it('assigns the data passed in as the payload to flush synchronously', () => {
      expect(Object.keys(api.payload).length).to.equal(0)
      api.populateDataSync({
        test: "value",
        metrics: "hello",
        analyticsEvents: null,
        cool_stuff: "camelCase"
      })
      expect(api.payload.test).to.be.undefined
      expect(api.payload.cool_stuff).to.be.undefined
      expect(api.payload.metric_data).to.equal("hello")
      expect(api.payload.analytic_event_data).to.be.undefined
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

    before(() => {
      logStub = sinon.stub(process.stdout, 'write').callsFake(() => {})
    })

    after(() => {
      logStub.restore()
    })

    it('compresses full payload and writes formatted to stdout', (done) => {
      api.payload = {type: 'test payload'}
      api.flushPayload(() => {
        const logPayload = JSON.parse(logStub.args[0][0])
        expect(logPayload).to.be.an('array')
        expect(logPayload[0]).to.be.a('number')
        expect(logPayload[1]).to.equal('NR_LAMBDA_MONITORING')
        expect(logPayload[2]).to.be.a('string')
        done()
      })
    })
  })
})
