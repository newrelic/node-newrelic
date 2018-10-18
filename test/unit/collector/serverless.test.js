'use strict'

const nock = require('nock')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const API = require('../../../lib/collector/serverless')

describe('ServerlessCollector API', () => {
  let api = null
  let agent = null

  beforeEach(() => {
    nock.disableNetConnect()
    agent = helper.loadMockedAgent(null, {
      serverless_mode: true,
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

  describe('#errorData', () => {
    it('adds error_data to the payload object', (done) => {
      const errorData = {type: 'error_data'}
      api.errorData(errorData, () => {
        expect(api.payload.error_data).to.deep.equal(errorData)
        done()
      })
    })
  })

  describe('#transactionSampleData', () => {
    it('adds transaction_sample_data to the payload object', (done) => {
      const transactionSampleData = {type: 'transaction_sample_data'}
      api.transactionSampleData(transactionSampleData, () => {
        expect(api.payload.transaction_sample_data).to.deep.equal(transactionSampleData)
        done()
      })
    })
  })

  describe('#analyticsEvents', () => {
    it('adds analytic_event_data to the payload object', (done) => {
      const analyticsEvents = {type: 'analytic_event_data'}
      api.analyticsEvents(analyticsEvents, () => {
        expect(api.payload.analytic_event_data).to.deep.equal(analyticsEvents)
        done()
      })
    })
  })

  describe('#customEvents', () => {
    it('adds custom_event_data to the payload object', (done) => {
      const customEvents = {type: 'custom_event_data'}
      api.customEvents(customEvents, () => {
        expect(api.payload.custom_event_data).to.deep.equal(customEvents)
        done()
      })
    })
  })

  describe('#errorEvents', () => {
    it('adds error_event_data to the payload object', (done) => {
      const errorEvents = {type: 'error_event_data'}
      api.errorEvents(errorEvents, () => {
        expect(api.payload.error_event_data).to.deep.equal(errorEvents)
        done()
      })
    })
  })

  describe('#spanEvents', () => {
    it('adds span_event_data to the payload object', (done) => {
      const spanEvents = {type: 'span_event_data'}
      api.spanEvents(spanEvents, () => {
        expect(api.payload.span_event_data).to.deep.equal(spanEvents)
        done()
      })
    })
  })

  describe('#preparePayload', () => {
    it('resets instance payload object', () => {
      api.payload = {type: 'initial payload'}
      api.preparePayload()
      expect(api.payload).to.deep.equal({})
    })
  })

  describe('#flushPayload', () => {
    let logStub = null

    before(() => {
      logStub = sinon.stub(console, 'log').callsFake(() => {})
    })

    after(() => {
      logStub.restore()
    })

    it('compresses full payload and writes formatted to stdout', (done) => {
      api.payload = {type: 'test payload'}
      api.flushPayload(() => {
        const logPayload = logStub.args[0][0]
        expect(logPayload).to.be.an('array')
        expect(logPayload[0]).to.be.a('number')
        expect(logPayload[1]).to.equal('NR_LAMBDA_MONITORING')
        expect(logPayload[2]).to.be.a('string')
        done()
      })
    })
  })
})
