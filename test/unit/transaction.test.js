'use strict'

var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , helper      = require('../lib/agent_helper.js')
  , API         = require('../../api.js')
  , Metrics     = require('../../lib/metrics.js')
  , Trace       = require('../../lib/transaction/trace.js')
  , Transaction = require('../../lib/transaction.js')
  , hashes      = require('../../lib/util/hashes')
  

describe("Transaction", function () {
  var agent
    , trans
    

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("should require an agent to create new transactions", function () {
    var trans
    expect(function () {
      trans = new Transaction()
    }).throws(/must be bound to the agent/)
  })

  it("should create a trace on demand", function () {
    var trace = trans.getTrace()
    expect(trace).instanceOf(Trace)
    expect(trans.trace).equal(trace)
  })

  it("should have at most one associated trace", function () {
    var trace = trans.getTrace()
    expect(trace).not.instanceof(Array)
  })

  it("should hand its metrics off to the agent upon finalization", function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner.metrics).equal(trans.metrics)

      return done()
    })

    trans.end()
  })

  it("should hand itself off to the agent upon finalization", function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner).equal(trans)

      return done()
    })

    trans.end()
  })

  describe("upon creation", function () {
    it("should have an ID", function () {
      should.exist(trans.id)
    })

    it("should have associated metrics", function () {
      should.exist(trans.metrics)
    })

    it("should be timing its duration", function () {
      return expect(trans.timer.isActive()).true
    })

    it("should be created without an associated trace", function () {
      expect(trans.trace).equal(null)
    })

    it("should have no associated URL (for hidden class)", function () {
      expect(trans.url).equal(null)
    })

    it("should have no name set (for hidden class)", function () {
      expect(trans.name).equal(null)
    })

    it("should have no PARTIAL name set (for hidden class)", function () {
      expect(trans.partialName).equal(null)
    })

    it("should have no HTTP status code set (for hidden class)", function () {
      expect(trans.statusCode).equal(null)
    })

    it("should have no error attached (for hidden class)", function () {
      expect(trans.error).equal(null)
    })

    it("should have no HTTP method / verb set (for hidden class)", function () {
      expect(trans.verb).equal(null)
    })

    it("should not be ignored by default (for hidden class)", function () {
      return expect(trans.ignore).false
    })
  })

  describe("with associated metrics", function () {
    it("should manage its own independent of the agent", function () {
      expect(trans.metrics).instanceOf(Metrics)
      expect(trans.metrics).not.equal(agent.metrics)
    })

    it("should have the same apdex threshold as the agent's", function () {
      expect(agent.metrics.apdexT).equal(trans.metrics.apdexT)
    })

    it("should have the same metrics mapper as the agent's", function () {
      expect(agent.mapper).equal(trans.metrics.mapper)
    })
  })

  it("should know when it's not a web transaction", function () {
    var trans = new Transaction(agent)
    expect(trans.isWeb()).equal(false)
  })

  it("should know when it's a web transaction", function () {
    var trans = new Transaction(agent)
    trans.url = '/test/1'
    expect(trans.isWeb()).equal(true)
  })

  describe("when dealing with individual metrics", function () {
    it("should add metrics by name", function () {
      var tt = new Transaction(agent)

      tt.measure('Custom/Test01')
      should.exist(tt.metrics.getMetric('Custom/Test01'))

      tt.end()
    })

    it("should allow multiple overlapping metric measurements for same name",
       function () {
      var TRACE_NAME = 'Custom/Test06'
        , SLEEP_DURATION = 43
        , tt = new Transaction(agent)
        

      tt.measure(TRACE_NAME, null, SLEEP_DURATION)
      tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5)

      var statistics = tt.metrics.getMetric(TRACE_NAME)
      expect(statistics.callCount).to.equal(2)
      expect(statistics.max).above((SLEEP_DURATION - 1) / 1000)
    })

    it("should allow manual setting of metric durations", function () {
      var tt = new Transaction(agent)

      tt.measure('Custom/Test16', null, 65)
      tt.end()

      var metrics = tt.metrics.getMetric('Custom/Test16')
      expect(metrics.total).equal(0.065)
    })
  })

  describe("when being named", function () {
    var trans

    beforeEach(function () {
      trans = new Transaction(agent)
    })

    it("should throw when called with no parameters", function () {
      expect(function () { trans.setName(); }).throws()
    })

    it("should ignore a request path when told to by a rule", function () {
      var api = new API(agent)
      api.addIgnoringRule('^/test/')
      trans.setName('/test/string?do=thing&another=thing', 200)
      return expect(trans.ignore).true
    })

    it("should ignore a transaction when told to by a rule", function () {
      agent.transactionNameNormalizer.addSimple('^WebTransaction/NormalizedUri')
      trans.setName('/test/string?do=thing&another=thing', 200)
      expect(trans.ignore).equal(true)
    })

    it("should pass through a name when told to by a rule", function () {
      agent.userNormalizer.addSimple('^/config', '/config')
      trans.setName('/config', 200)
      expect(trans.name).equal('WebTransaction/NormalizedUri/config')
    })

    describe("with no partial name set", function () {
      it("produces a normalized (backstopped) name when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it("produces a normalized partial name when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.partialName).equal('NormalizedUri/*')
      })

      it("passes through status code when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it("produces a non-error name when status code is ignored", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it("produces a non-error partial name when status code is ignored", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.partialName).equal('NormalizedUri/*')
      })

      it("passes through status code when status is 404", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it("produces a regular name when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it("produces a regular partial name when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.partialName).equal('NormalizedUri/*')
      })

      it("passes through status code when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })
    })

    describe("with a custom partial name set", function () {
      beforeEach(function () {
        trans.partialName = 'Custom/test'
      })

      it("produces a custom name when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it("produces a partial name when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.partialName).equal('Custom/test')
      })

      it("should rename a transaction when told to by a rule", function () {
        agent.transactionNameNormalizer.addSimple(
          '^(WebTransaction/Custom)/test$',
          '$1/*'
        )
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/*')
      })

      it("passes through status code when status is 200", function () {
        trans.setName('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it("keeps the custom name when error status is ignored", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it("keeps the custom partial name when error status is ignored", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.partialName).equal('Custom/test')
      })

      it("passes through status code when status is 404", function () {
        trans.setName('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it("produces the custom name even when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it("produces the custome partial name even when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.partialName).equal('Custom/test')
      })

      it("passes through status code when status is 501", function () {
        trans.setName('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })

      it("should ignore a transaction when told to by a rule", function () {
        agent.transactionNameNormalizer.addSimple('^WebTransaction/Custom/test$')
        trans.setName('/test/string?do=thing&another=thing', 200)
        return expect(trans.ignore).true
      })
    })
  })

  describe("when setting apdex for key transactions", function () {
    var trans
      , metric
      

    before(function () {
      trans = new Transaction(agent)
      trans._setApdex('Apdex/TestController/key', 1200, 667)

      metric = trans.metrics.getMetric('Apdex/TestController/key')
    })

    it("should set apdexT to the key transaction apdexT", function () {
      expect(metric.apdexT).equal(0.667)
    })

    it("should not have satisfied", function () {
      expect(metric.satisfying).equal(0)
    })

    it("should have been tolerated", function () {
      expect(metric.tolerating).equal(1)
    })

    it("should not have frustrated", function () {
      expect(metric.frustrating).equal(0)
    })

    it("shouldn't require a key transaction apdexT", function () {
      trans._setApdex('Apdex/TestController/another', 1200)
      var another = trans.metrics.getMetric('Apdex/TestController/another')
      expect(another.apdexT).equal(0.1)
    })
  })

  describe("when producing a summary of the whole transaction", function () {
    it("should produce a human-readable summary")
    it("should produce a metrics summary suitable for the collector")
  })

  it("shouldn't scope web transactions to their URL", function () {
    var trans = new Transaction(agent)
    trans.setName('/test/1337?action=edit', 200)
    expect(trans.name).not.equal('/test/1337?action=edit')
    expect(trans.name).not.equal('WebTransaction/Uri/test/1337')
  })

  describe('pathHashes', function () {
    var transaction

    beforeEach(function() {
      transaction = new Transaction(agent)
    })

    it('should add up to 10 items to to pathHashes', function() {
      var toAdd = ['1', '2', '3', '4', '4', '5', '6', '7', '8', '9', '10', '11']
      var expected = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

      toAdd.forEach(transaction.pushPathHash.bind(transaction))
      expect(transaction.pathHashes).deep.equal(expected)
    })

    it('should not include current pathHash in alternatePathHashes', function() {
      transaction.name = '/a/b/c'
      transaction.referringPathHash = '/d/e/f'

      var curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        transaction.name,
        transaction.referringPathHash
      )

      transaction.pathHashes = ['/a', curHash, '/a/b']
      expect(transaction.alternatePathHashes()).equal('/a,/a/b')
      transaction.partialName = transaction.name
      transaction.name = null
      transaction.pathHashes = ['/a', '/a/b']
      expect(transaction.alternatePathHashes()).equal('/a,/a/b')
    })

    it('should return null when no alternate pathHashes exist', function() {
      transaction.partialName = '/a/b/c'
      transaction.referringPathHash = '/d/e/f'

      var curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        transaction.partialName,
        transaction.referringPathHash
      )

      transaction.pathHashes = [curHash]
      expect(transaction.alternatePathHashes()).equal(null)
      transaction.pathHashes = []
      expect(transaction.alternatePathHashes()).equal(null)
    })
  })
})
