'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

var API = require('../../../api')
var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var sinon = require('sinon')
var shimmer = require('../../../lib/shimmer')

describe('the New Relic agent API', function() {
  var URL = '/test/path/31337'
  var NAME = 'WebTransaction/Uri/test/path/31337'
  var agent
  var api


  beforeEach(function() {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it("exports a transaction naming function", function() {
    should.exist(api.setTransactionName)
    expect(api.setTransactionName).to.be.a('function')
  })

  it("exports a controller naming function", function() {
    should.exist(api.setControllerName)
    expect(api.setControllerName).to.be.a('function')
  })

  it("exports a transaction ignoring function", function() {
    should.exist(api.setIgnoreTransaction)
    expect(api.setIgnoreTransaction).to.be.a('function')
  })

  it("exports a function for adding naming rules", function() {
    should.exist(api.addNamingRule)
    expect(api.addNamingRule).to.be.a('function')
  })

  it("exports a function for ignoring certain URLs", function() {
    should.exist(api.addIgnoringRule)
    expect(api.addIgnoringRule).to.be.a('function')
  })

  it("exports a function for adding custom instrumentation", function() {
    should.exist(api.instrument)
    expect(api.instrument).to.be.a('function')
  })

  describe("when explicitly naming transactions", function() {
    describe("in the simplest case", function() {
      var segment
      var transaction

      beforeEach(function(done) {
        agent.on('transactionFinished', function(t) {
          // grab transaction
          transaction = t
          transaction.finalizeNameFromUri(URL, 200)
          segment.markAsWeb(URL)
          done()
        })

        helper.runInTransaction(agent, function(tx) {
          // grab segment
          agent.tracer.addSegment(NAME, null, null, false, function() {
            // HTTP instrumentation sets URL as soon as it knows it
            segment = agent.tracer.getSegment()
            tx.type = 'web'
            tx.url = URL
            tx.verb = 'POST'

            // Name the transaction
            api.setTransactionName('Test')

            tx.end()
          })
        })
      })

      it("sets the transaction name to the custom name", function() {
        expect(transaction.name).equal('WebTransaction/Custom/Test')
      })

      it("names the web trace segment after the custom name", function() {
        expect(segment.name).equal('WebTransaction/Custom/Test')
      })

      it("leaves the request URL alone", function() {
        expect(transaction.url).equal(URL)
      })
    })

    it("uses the last name set when called multiple times", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/Custom/List')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.setTransactionName('Index')
        api.setTransactionName('Update')
        api.setTransactionName('Delete')
        api.setTransactionName('List')

        transaction.end()
      })
    })
  })

  describe("when (not) ignoring a transaction", function() {
    it("should mark the transaction ignored", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.ignore).equal(true)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(true)

        transaction.end()
      })
    })

    it("should force a transaction to not be ignored", function(done) {
      api.addIgnoringRule('^/test/.*')

      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(false)

        transaction.end()
      })
    })
  })

  describe('when recording custom metrics', function() {
    it('should prepend "Custom" in front of name', () => {
      api.recordMetric('metric/thing', 3)
      api.recordMetric('metric/thing', 4)
      api.recordMetric('metric/thing', 5)

      const metric = api.agent.metrics.getMetric('Custom/metric/thing')
      expect(metric).to.exist
    })

    it('it should aggregate metric values', function() {
      api.recordMetric('metric/thing', 3)
      api.recordMetric('metric/thing', 4)
      api.recordMetric('metric/thing', 5)

      const metric = api.agent.metrics.getMetric('Custom/metric/thing')

      expect(metric.total).equal(12)
      expect(metric.totalExclusive).equal(12)
      expect(metric.min).equal(3)
      expect(metric.max).equal(5)
      expect(metric.sumOfSquares).equal(50)
      expect(metric.callCount).equal(3)
    })

    it('it should merge metrics', function() {
      api.recordMetric('metric/thing', 3)
      api.recordMetric('metric/thing', {
        total: 9,
        min: 4,
        max: 5,
        sumOfSquares: 41,
        count: 2
      })

      const metric = api.agent.metrics.getMetric('Custom/metric/thing')

      expect(metric.total).equal(12)
      expect(metric.totalExclusive).equal(12)
      expect(metric.min).equal(3)
      expect(metric.max).equal(5)
      expect(metric.sumOfSquares).equal(50)
      expect(metric.callCount).equal(3)
    })

    it('it should increment properly', function() {
      api.incrementMetric('metric/thing')
      api.incrementMetric('metric/thing')
      api.incrementMetric('metric/thing')

      const metric = api.agent.metrics.getMetric('Custom/metric/thing')

      expect(metric.total).equal(0)
      expect(metric.totalExclusive).equal(0)
      expect(metric.min).equal(0)
      expect(metric.max).equal(0)
      expect(metric.sumOfSquares).equal(0)
      expect(metric.callCount).equal(3)

      api.incrementMetric('metric/thing', 4)
      api.incrementMetric('metric/thing', 5)


      expect(metric.total).equal(0)
      expect(metric.totalExclusive).equal(0)
      expect(metric.min).equal(0)
      expect(metric.max).equal(0)
      expect(metric.sumOfSquares).equal(0)
      expect(metric.callCount).equal(12)
    })
  })

  describe('instrument', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrument(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrument('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('instrumentConglomerate', () => {
    beforeEach(() => {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(() => {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', () => {
      const opts = {
        moduleName: 'foobar',
        onRequire: () => {}
      }
      api.instrumentConglomerate(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      const args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
        .and.have.property('type', 'conglomerate')
    })

    it('should convert separate args into an options object', () => {
      function onRequire() {}
      function onError() {}
      api.instrumentConglomerate('foobar', onRequire, onError)

      const opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('instrumentDatastore', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrumentDatastore(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
        .and.have.property('type', 'datastore')
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrumentDatastore('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('instrumentWebframework', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrumentWebframework(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
        .and.have.property('type', 'web-framework')
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrumentWebframework('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('setLambdaHandler', () => {
    it('should report API supportability metric', () => {
      api.setLambdaHandler(() => {})

      const metric =
        agent.metrics.getMetric('Supportability/API/setLambdaHandler')
      expect(metric.callCount).to.equal(1)
    })
  })

  describe('getLinkingMetadata', () => {
    it('should return metadata necessary for linking data to a trace', () => {
      let metadata = api.getLinkingMetadata()

      expect(metadata['trace.id']).to.be.undefined
      expect(metadata['span.id']).to.be.undefined
      expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
      expect(metadata['entity.type']).to.equal('SERVICE')
      expect(metadata['entity.guid']).to.be.undefined
      expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())

      // Test in a transaction
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        // trace and span id are omitted when dt is disabled
        expect(metadata['trace.id']).to.be.undefined
        expect(metadata['span.id']).to.be.undefined
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.be.undefined
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })

      // With DT enabled
      agent.config.distributed_tracing.enabled = true

      // Trace and span id are omitted when there is no active transaction
      expect(metadata['trace.id']).to.be.undefined
      expect(metadata['span.id']).to.be.undefined
      expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
      expect(metadata['entity.type']).to.equal('SERVICE')
      expect(metadata['entity.guid']).to.be.undefined
      expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())

      // Test in a transaction
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        expect(metadata['trace.id']).to.be.a('string')
        expect(metadata['span.id']).to.be.a('string')
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.be.undefined
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })

      // Test with an entity_guid set and in a transaction
      helper.unloadAgent(agent)
      agent = helper.loadMockedAgent({
        entity_guid: 'test',
        distributed_tracing: { enabled: true }
      })
      api = new API(agent)
      helper.runInTransaction(agent, function() {
        metadata = api.getLinkingMetadata()
        expect(metadata['trace.id']).to.be.a('string')
        expect(metadata['span.id']).to.be.a('string')
        expect(metadata['entity.name']).to.equal('New Relic for Node.js tests')
        expect(metadata['entity.type']).to.equal('SERVICE')
        expect(metadata['entity.guid']).to.equal('test')
        expect(metadata.hostname).to.equal(agent.config.getHostnameSafe())
      })
    })
  })
})
