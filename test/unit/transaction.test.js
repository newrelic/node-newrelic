'use strict'

var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var helper = require('../lib/agent_helper')
var API = require('../../api')
var AttributeFilter = require('../../lib/config/attribute-filter')
var Metrics = require('../../lib/metrics')
var Trace = require('../../lib/transaction/trace')
var Transaction = require('../../lib/transaction')
var hashes = require('../../lib/util/hashes')
const sinon = require('sinon')


describe('Transaction', function() {
  var agent = null
  var trans = null

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      attributes: {enabled: true}
    })
    trans = new Transaction(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it('should require an agent to create new transactions', function() {
    expect(function() {
      return new Transaction()
    }).throws(/must be bound to the agent/)
  })

  it('should create a trace on demand', function() {
    var trace = trans.trace
    expect(trace).instanceOf(Trace)
    expect(trans.trace).equal(trace)
  })

  it('should have at most one associated trace', function() {
    var trace = trans.trace
    expect(trace).not.instanceof(Array)
  })

  it('should hand its metrics off to the agent upon finalization', function(done) {
    agent.on('transactionFinished', function(inner) {
      expect(inner.metrics).equal(trans.metrics)

      return done()
    })

    trans.end()
  })

  describe('when distributed tracing is enabled', function() {
    beforeEach(function() {
      agent.config.distributed_tracing.enabled = true
    })

    afterEach(function() {
      agent.config.distributed_tracing.enabled = false
    })

    it('should produce span events when finalizing', function(done) {
      agent.once('transactionFinished', function() {
        expect(agent.spanEventAggregator.length).to.equal(1)

        return done()
      })
      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        txn.end()
      })
    })

    it('should not produce span events when ignored', function(done) {
      agent.once('transactionFinished', function() {
        expect(agent.spanEventAggregator.length).to.equal(0)

        return done()
      })

      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        txn.ignore = true
        txn.end()
      })
    })
  })

  it('should hand itself off to the agent upon finalization', function(done) {
    agent.on('transactionFinished', function(inner) {
      expect(inner).equal(trans)

      return done()
    })

    trans.end()
  })

  describe('upon creation', function() {
    it('should have an ID', function() {
      should.exist(trans.id)
    })

    it('should have associated metrics', function() {
      should.exist(trans.metrics)
    })

    it('should be timing its duration', function() {
      return expect(trans.timer.isActive()).true
    })

    it('should have no associated URL (for hidden class)', function() {
      expect(trans.url).equal(null)
    })

    it('should have no name set (for hidden class)', function() {
      expect(trans.name).equal(null)
    })

    it('should have no PARTIAL name set (for hidden class)', function() {
      expect(trans.nameState.getName()).equal(null)
    })

    it('should have no HTTP status code set (for hidden class)', function() {
      expect(trans.statusCode).equal(null)
    })

    it('should have no error attached (for hidden class)', function() {
      expect(trans.error).equal(null)
    })

    it('should have no HTTP method / verb set (for hidden class)', function() {
      expect(trans.verb).equal(null)
    })

    it('should not be ignored by default (for hidden class)', function() {
      return expect(trans.ignore).false
    })

    it('should not have a sampled state set', function() {
      expect(trans.sampled).to.equal(null)
    })
  })

  describe('with associated metrics', function() {
    it('should manage its own independent of the agent', function() {
      expect(trans.metrics).instanceOf(Metrics)
      expect(trans.metrics).not.equal(getMetrics(agent))
    })

    it('should have the same apdex threshold as the agent', function() {
      expect(getMetrics(agent).apdexT).equal(trans.metrics.apdexT)
    })

    it('should have the same metrics mapper as the agent', function() {
      expect(agent.mapper).equal(trans.metrics.mapper)
    })
  })

  it('should know when it is not a web transaction', function() {
    var tx = new Transaction(agent)
    tx.type = Transaction.TYPES.BG
    expect(tx.isWeb()).to.be.false
  })

  it('should know when it is a web transaction', function() {
    var tx = new Transaction(agent)
    tx.type = Transaction.TYPES.WEB
    expect(tx.isWeb()).to.be.true
  })

  describe('when dealing with individual metrics', function() {
    it('should add metrics by name', function() {
      var tt = new Transaction(agent)

      tt.measure('Custom/Test01')
      should.exist(tt.metrics.getMetric('Custom/Test01'))

      tt.end()
    })

    it('should allow multiple overlapping metric measurements for same name', function() {
      var TRACE_NAME = 'Custom/Test06'
      var SLEEP_DURATION = 43
      var tt = new Transaction(agent)

      tt.measure(TRACE_NAME, null, SLEEP_DURATION)
      tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5)

      var statistics = tt.metrics.getMetric(TRACE_NAME)
      expect(statistics.callCount).to.equal(2)
      expect(statistics.max).above((SLEEP_DURATION - 1) / 1000)
    })

    it('should allow manual setting of metric durations', function() {
      var tt = new Transaction(agent)

      tt.measure('Custom/Test16', null, 65)
      tt.end()

      var metrics = tt.metrics.getMetric('Custom/Test16')
      expect(metrics.total).equal(0.065)
    })
  })

  describe('when being named', function() {
    beforeEach(function() {
      agent.config.attributes.enabled = true
      agent.config.attributes.include = ['request.parameters.*']
      agent.config.emit('attributes.include')

      trans = new Transaction(agent)
    })

    describe('with finalizeNameFromUri', function() {
      it('should throw when called with no parameters', function() {
        expect(function() { trans.finalizeNameFromUri() }).to.throw()
      })

      it('should ignore a request path when told to by a rule', function() {
        var api = new API(agent)
        api.addIgnoringRule('^/test/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.isIgnored()).to.be.true
      })

      it('should ignore a transaction when told to by a rule', function() {
        agent.transactionNameNormalizer.addSimple('^WebTransaction/NormalizedUri')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.isIgnored()).to.be.true
      })

      it('should pass through a name when told to by a rule', function() {
        agent.userNormalizer.addSimple('^/config', '/foobar')
        trans.finalizeNameFromUri('/config', 200)
        expect(trans.name).to.equal('WebTransaction/NormalizedUri/foobar')
      })

      describe('when tx.nameState is populated', function() {
        beforeEach(function() {
          trans.baseSegment = trans.trace.root.add('basesegment')
          trans.nameState.setPrefix('Restify')
          trans.nameState.setVerb('COOL')
          trans.nameState.setDelimiter('/')
          trans.nameState.appendPath('/foo/:foo', {foo: 'biz'})
          trans.nameState.appendPath('/bar/:bar', {bar: 'bang'})
        })

        it('should name the transaction using the name stack', function() {
          trans.finalizeNameFromUri('/some/random/path', 200)
          expect(trans.name)
            .to.equal('WebTransaction/Restify/COOL//foo/:foo/bar/:bar')
        })

        it('should copy parameters from the name stack', function() {
          trans.finalizeNameFromUri('/some/random/path', 200)
          var attrs = trans.trace.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE)
          expect(attrs).to.deep.equal({
            'request.parameters.foo': 'biz',
            'request.parameters.bar': 'bang'
          })
        })

        describe('and high_security is on', function() {
          beforeEach(function() {
            agent.config.high_security = true
            agent.config._applyHighSecurity()
            agent.config.emit('attributes.include')
          })

          it('should still name the transaction using the name stack', function() {
            trans.finalizeNameFromUri('/some/random/path', 200)
            expect(trans.name)
              .to.equal('WebTransaction/Restify/COOL//foo/:foo/bar/:bar')
          })

          it('should not copy parameters from the name stack', function() {
            trans.finalizeNameFromUri('/some/random/path', 200)
            var attrs = trans.trace.attributes.get(
              AttributeFilter.DESTINATIONS.TRANS_TRACE
            )
            expect(attrs).to.deep.equal({})
          })
        })
      })
    })

    describe('with finalizeName', function() {
      it('should call finalizeNameFromUri if no name is given for a web tx', function() {
        var called = false
        trans.finalizeNameFromUri = function() { called = true }
        trans.type = 'web'
        trans.url = '/foo/bar'
        trans.finalizeName()
        expect(called).to.be.true
      })

      it('should apply ignore rules', function() {
        agent.transactionNameNormalizer.addSimple('foo') // Ignore foo
        trans.finalizeName('foo')
        expect(trans.isIgnored()).to.be.true
      })

      it('should not apply user naming rules', function() {
        agent.userNormalizer.addSimple('^/config', '/foobar')
        trans.finalizeName('/config')
        expect(trans.getFullName()).to.equal('WebTransaction//config')
      })
    })

    describe('getName', function() {
      it('should return `null` if there is no name, partialName, or url', function() {
        expect(trans.getName()).to.be.null
      })

      it('partial name should remain unset if it was not set before', function() {
        trans.url = '/some/pathname'
        expect(trans.nameState.getName()).to.be.null
        expect(trans.getName()).to.equal('NormalizedUri/*')
        expect(trans.nameState.getName()).to.be.null
      })

      it('should return the right name if partialName and url are set', function() {
        trans.nameState.setPrefix('Framework')
        trans.nameState.setVerb('verb')
        trans.nameState.appendPath('route')
        trans.url = '/route'
        expect(trans.getName())
          .to.equal('WebFrameworkUri/Framework/VERB/route')
        expect(trans.nameState.getName()).to.equal('Framework/VERB/route')
      })

      it('should return the name if it has already been set', function() {
        trans.setPartialName('foo/bar')
        expect(trans.getName()).equal('foo/bar')
      })
    })

    describe('isIgnored', function() {
      it('should return true if a transaction is ignored through the api', function() {
        var api = new API(agent)
        helper.runInTransaction(agent, function(txn) {
          api.setIgnoreTransaction(true)
          expect(txn.isIgnored()).to.be.true
        })
      })
      it ('should return true if a transaction is ignored by a rule', function() {
        var api = new API(agent)
        api.addIgnoringRule('^/test/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.isIgnored()).true
      })
    })

    describe('getFullName', function() {
      it('should return null if it does not have name, partialName, or url', function() {
        expect(trans.getFullName()).equal(null)
      })

      it('partial name should remain unset if it was not set before', function() {
        trans.url = '/some/pathname'
        expect(trans.nameState.getName()).to.equal(null)
        expect(trans.getFullName()).to.equal('WebTransaction/NormalizedUri/*')
        expect(trans.nameState.getName()).to.equal(null)
      })

      it('should return the right name if partialName and url are set', function() {
        trans.nameState.setPrefix('Framework')
        trans.nameState.setVerb('verb')
        trans.nameState.appendPath('route')
        trans.url = '/route'
        expect(trans.getFullName())
          .to.equal('WebTransaction/WebFrameworkUri/Framework/VERB/route')
        expect(trans.nameState.getName()).to.equal('Framework/VERB/route')
      })

      it('should return the name if it has already been set', function() {
        trans.name = 'OtherTransaction/foo/bar'
        expect(trans.getFullName()).to.equal('OtherTransaction/foo/bar')
      })

      it('should return the forced name if set', function() {
        trans.name = 'FullName'
        trans._partialName = 'PartialName'
        trans.forceName = 'ForcedName'
        expect(trans.getFullName()).to.equal('WebTransaction/ForcedName')
      })
    })

    describe('with no partial name set', function() {
      it('produces a normalized (backstopped) name when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it('produces a normalized partial name when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans._partialName).equal('NormalizedUri/*')
      })

      it('passes through status code when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it('produces a non-error name when status code is ignored', function() {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it('produces a non-error partial name when status code is ignored', function() {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans._partialName).equal('NormalizedUri/*')
      })

      it('passes through status code when status is 404', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it('produces a `not found` partial name when status is 404', function() {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans._partialName).equal('Expressjs/GET/(not found)')
      })

      it('produces a `not found` name when status is 404', function() {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.name).equal('WebTransaction/Expressjs/GET/(not found)')
      })

      it('passes through status code when status is 405', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans.statusCode).equal(405)
      })

      it('produces a `method not allowed` partial name when status is 405', function() {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans._partialName).equal('Expressjs/GET/(method not allowed)')
      })

      it('produces a `method not allowed` name when status is 405', function() {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans.name).equal('WebTransaction/Expressjs/GET/(method not allowed)')
      })

      it('produces a name based on 501 status code message', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/WebFrameworkUri/(not implemented)')
      })

      it('produces a regular partial name based on 501 status code message', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans._partialName).equal('WebFrameworkUri/(not implemented)')
      })

      it('passes through status code when status is 501', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })
    })

    describe('with a custom partial name set', function() {
      beforeEach(function() {
        trans.nameState.setPrefix('Custom')
        trans.nameState.appendPath('test')
      })

      it('produces a custom name when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('produces a partial name when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('should rename a transaction when told to by a rule', function() {
        agent.transactionNameNormalizer.addSimple(
          '^(WebTransaction/Custom)/test$',
          '$1/*'
        )
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/*')
      })

      it('passes through status code when status is 200', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it('keeps the custom name when error status is ignored', function() {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('keeps the custom partial name when error status is ignored', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('passes through status code when status is 404', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it('produces the custom name even when status is 501', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('produces the custome partial name even when status is 501', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('passes through status code when status is 501', function() {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })

      it('should ignore a transaction when told to by a rule', function() {
        agent.transactionNameNormalizer.addSimple('^WebTransaction/Custom/test$')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        return expect(trans.isIgnored()).true
      })
    })
  })

  describe('when setting apdex for key transactions', function() {
    var tx = null
    var metric = null

    before(function() {
      tx = new Transaction(agent)
      tx._setApdex('Apdex/TestController/key', 1200, 667)

      metric = tx.metrics.getMetric('Apdex/TestController/key')
    })

    it('should set apdexT to the key transaction apdexT', function() {
      expect(metric.apdexT).equal(0.667)
    })

    it('should not have satisfied', function() {
      expect(metric.satisfying).equal(0)
    })

    it('should have been tolerated', function() {
      expect(metric.tolerating).equal(1)
    })

    it('should not have frustrated', function() {
      expect(metric.frustrating).equal(0)
    })

    it('should not require a key transaction apdexT', function() {
      tx._setApdex('Apdex/TestController/another', 1200)
      var another = tx.metrics.getMetric('Apdex/TestController/another')
      expect(another.apdexT).equal(0.1)
    })
  })

  describe('when producing a summary of the whole transaction', function() {
    it('should produce a human-readable summary')
    it('should produce a metrics summary suitable for the collector')
  })

  it('should not scope web transactions to their URL', function() {
    var tx = new Transaction(agent)
    tx.finalizeNameFromUri('/test/1337?action=edit', 200)
    expect(tx.name).not.equal('/test/1337?action=edit')
    expect(tx.name).not.equal('WebTransaction/Uri/test/1337')
  })

  describe('pathHashes', function() {
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
      transaction.nameState.setPrefix(transaction.name)
      transaction.name = null
      transaction.pathHashes = ['/a', '/a/b']
      expect(transaction.alternatePathHashes()).equal('/a,/a/b')
    })

    it('should return null when no alternate pathHashes exist', function() {
      transaction.nameState.setPrefix('/a/b/c')
      transaction.referringPathHash = '/d/e/f'

      var curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        transaction.nameState.getName(),
        transaction.referringPathHash
      )

      transaction.pathHashes = [curHash]
      expect(transaction.alternatePathHashes()).equal(null)
      transaction.pathHashes = []
      expect(transaction.alternatePathHashes()).equal(null)
    })
  })

  describe('hasErrors', function() {
    var transaction

    beforeEach(function() {
      transaction = new Transaction(agent)
    })

    it('should return true if exceptions property is not empty', function() {
      expect(transaction.hasErrors()).to.be.false
      transaction.exceptions.push(new Error())
      expect(transaction.hasErrors()).to.be.true
    })

    it('should return true if statusCode is an error', function() {
      transaction.statusCode = 500
      expect(transaction.hasErrors()).to.be.true
    })
  })

  describe('isSampled', function() {
    let transaction

    beforeEach(function() {
      transaction = new Transaction(agent)
    })

    it('should be true when the transaction is sampled', function() {
      // the first 10 transactions are sampled so this should be true
      expect(transaction.isSampled()).to.be.true
    })

    it('should be false when the transaction is not sampled', function() {
      transaction.priority = Infinity
      transaction.sampled = false
      expect(transaction.isSampled()).to.be.false
    })
  })

  describe('getIntrinsicAttributes', function() {
    var transaction

    beforeEach(function() {
      transaction = new Transaction(agent)
    })

    it('includes CAT attributes', function() {
      transaction.tripId = '3456'
      transaction.referringTransactionGuid = '1234'
      transaction.incomingCatId = '2345'

      var attributes = transaction.getIntrinsicAttributes()
      expect(attributes.referring_transaction_guid).equal('1234')
      expect(attributes.client_cross_process_id).equal('2345')
      expect(attributes.path_hash).to.be.a('string')
      expect(attributes.trip_id).equal('3456')
    })

    it('includes Synthetics attributes', function() {
      transaction.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      var attributes = transaction.getIntrinsicAttributes()
      expect(attributes.synthetics_resource_id).equal('resId')
      expect(attributes.synthetics_job_id).equal('jobId')
      expect(attributes.synthetics_monitor_id).equal('monId')
    })

    it('returns different object every time', function() {
      expect(transaction.getIntrinsicAttributes()).to.not.equal(
        transaction.getIntrinsicAttributes()
      )
    })

    it('includes distributed trace attributes if flag is enabled', function() {
      transaction.agent.config.distributed_tracing.enabled = true

      var attributes = transaction.getIntrinsicAttributes()
      expect(transaction.priority.toString().length).to.be.at.most(8)

      expect(attributes).to.have.property('guid', transaction.id)
      expect(attributes).to.have.property('traceId', transaction.id)
      expect(attributes).to.have.property('priority', transaction.priority)
      expect(attributes).to.have.property('sampled', true)
    })
  })

  describe('getResponseDurationInMillis', function() {
    var transaction

    beforeEach(function() {
      transaction = new Transaction(agent)
    })

    describe('for web transactions', function() {
      it('should use the time until transaction.end() is called', function() {
        transaction.url = 'someUrl'

        // add a segment that will end after the transaction ends
        var childSegment = transaction.trace.add('child')
        childSegment.start()

        transaction.end()
        childSegment.end()

        // response time should equal the transaction timer duration
        expect(transaction.getResponseTimeInMillis()).to.equal(
          transaction.timer.getDurationInMillis()
        )
      })
    })

    describe('for background transactions', function() {
      it('should report response time equal to trace duration', function() {
        // add a segment that will end after the transaction ends
        transaction.type = Transaction.TYPES.BG
        var bgTransactionSegment = transaction.trace.add('backgroundWork')
        bgTransactionSegment.start()

        transaction.end()
        bgTransactionSegment.end()

        // response time should equal the full duration of the trace
        expect(transaction.getResponseTimeInMillis()).to.equal(
          transaction.trace.getDurationInMillis()
        )
      })
    })
  })

  describe('acceptDistributedTracePayload', function() {
    var tx = null

    beforeEach(function() {
      agent.recordSupportability = sinon.spy()
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'

      // Clear deprecated values just to be extra sure.
      agent.config.cross_process_id = null
      agent.config.trusted_account_ids = null

      tx = new Transaction(agent)
    })

    afterEach(function() {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('records supportability metric if no payload was passed', function() {
      tx.acceptDistributedTracePayload(null)
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Ignored/Null'
      )
    })

    describe('when already marked as distributed trace', function() {
      it('records `Multiple` supportability metric if parentId exists', function() {
        tx.isDistributedTrace = true
        tx.parentId = 'exists'

        tx.acceptDistributedTracePayload({})
        expect(tx.agent.recordSupportability.args[0][0]).to.equal(
          'DistributedTrace/AcceptPayload/Ignored/Multiple'
        )
      })

      it('records `CreateBeforeAccept` metric if parentId does not exist', function() {
        tx.isDistributedTrace = true

        tx.acceptDistributedTracePayload({})
        expect(tx.agent.recordSupportability.args[0][0]).to.equal(
          'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
        )
      })
    })

    it('should not accept payload if no configured trusted key', function() {
      tx.agent.config.trusted_account_key = null
      tx.agent.config.account_id = null

      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})

      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Exception'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should not accept payload if DT disabled', function() {
      tx.agent.config.distributed_tracing.enabled = false

      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})

      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Exception'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should accept payload if config valid and CAT disabled', function() {
      tx.agent.config.cross_application_tracer.enabled = false

      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})

      expect(tx.isDistributedTrace).to.be.true
    })

    it('fails if payload version is above agent-supported version', function() {
      tx.acceptDistributedTracePayload({v: [1, 0]})
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/ParseException'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('fails if payload account id is not in trusted ids', function() {
      const data = {
        ac: 2,
        ty: 'App',
        id: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now()
      }

      tx.acceptDistributedTracePayload({
        v: [0, 1],
        d: data
      })
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Ignored/UntrustedAccount'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('fails if payload data is missing required keys', function() {
      tx.acceptDistributedTracePayload({
        v: [0, 1],
        d: {
          ac: 1
        }
      })
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/ParseException'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('takes the priority and sampled state from the incoming payload', function() {
      const data = {
        ac: '1',
        ty: 'App',
        id: tx.id,
        tr: tx.id,
        ap: 'test',
        pr: 1.9999999,
        sa: true,
        ti: Date.now()
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})
      expect(tx.sampled).to.be.true
      expect(tx.priority).to.equal(data.pr)
      // Should not truncate accepted priority
      expect(tx.priority.toString().length).to.equal(9)
    })

    it('does not take the distributed tracing data if priority is missing', function() {
      const data = {
        ac: 1,
        ty: 'App',
        id: tx.id,
        tr: tx.id,
        ap: 'test',
        sa: true,
        ti: Date.now()
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})
      expect(tx.priority).to.equal(null)
      expect(tx.sampled).to.equal(null)
    })

    it('stores payload props on transaction', function() {
      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Success'
      )
      expect(tx.parentId).to.equal(data.tx)
      expect(tx.parentType).to.equal(data.ty)
      expect(tx.traceId).to.equal(data.tr)
      expect(tx.isDistributedTrace).to.be.true
      expect(tx.parentTransportDuration).to.be.greaterThan(0)
    })

    it('should 0 transport duration when receiving payloads from the future', function() {
      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        id: tx.trace.root.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() + 1000
      }

      tx.acceptDistributedTracePayload({v: [0, 1], d: data})
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Success'
      )
      expect(tx.parentId).to.equal(data.tx)
      expect(tx.parentSpanId).to.equal(tx.trace.root.id)
      expect(tx.parentType).to.equal(data.ty)
      expect(tx.traceId).to.equal(data.tr)
      expect(tx.isDistributedTrace).to.be.true
      expect(tx.parentTransportDuration).to.equal(0)
    })
  })

  describe('_getParsedPayload', function() {
    var tx = null
    var payload = null

    beforeEach(function() {
      agent.recordSupportability = sinon.spy()
      tx = new Transaction(agent)
      payload = JSON.stringify({
        test: 'payload'
      })
    })

    afterEach(function() {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('returns parsed JSON object', function() {
      const res = tx._getParsedPayload(payload)
      expect(res).to.deep.equal({ test: 'payload' })
    })

    it('returns parsed object from base64 string', function() {
      tx.agent.config.encoding_key = 'test'

      const res = tx._getParsedPayload(payload.toString('base64'))
      expect(res).to.deep.equal({ test: 'payload' })
    })

    it('returns null if string is invalid JSON', function() {
      const res = tx._getParsedPayload('{invalid JSON string}')
      expect(res).to.be.null
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/ParseException'
      )
    })

    it('returns null if decoding fails', function() {
      tx.agent.config.encoding_key = 'test'
      payload = hashes.obfuscateNameUsingKey(payload, 'some other key')

      const res = tx._getParsedPayload(payload)
      expect(res).to.be.null
    })
  })

  describe('createDistributedTracePayload', function() {
    var tx = null

    beforeEach(function() {
      agent.recordSupportability = sinon.spy()
      agent.config.distributed_tracing.enabled = true
      agent.config.account_id = '5678'
      agent.config.primary_application_id = '1234'
      agent.config.trusted_account_key = '5678'

      // Clear deprecated values just to be extra sure.
      agent.config.cross_process_id = null
      agent.config.trusted_account_ids = null

      tx = new Transaction(agent)
    })

    afterEach(function() {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('should not create payload when DT disabled', function() {
      tx.agent.config.distributed_tracing.enabled = false

      const payload = tx.createDistributedTracePayload().text()
      expect(payload).to.equal('')
      expect(tx.agent.recordSupportability.callCount).to.equal(0)
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should create payload when DT enabled and CAT disabled', function() {
      tx.agent.config.cross_application_tracer.enabled = false

      const payload = tx.createDistributedTracePayload().text()

      expect(payload).to.not.be.null
      expect(payload).to.not.equal('')
    })

    it('generates a priority for entry-point transactions', () => {
      expect(tx.priority).to.equal(null)
      expect(tx.sampled).to.equal(null)

      tx.createDistributedTracePayload()

      expect(tx.priority).to.be.a('number')
      expect(tx.sampled).to.be.a('boolean')
    })

    it('does not change existing priority', () => {
      tx.priority = 999
      tx.sampled = false

      tx.createDistributedTracePayload()

      expect(tx.priority).to.equal(999)
      expect(tx.sampled).to.be.false
    })

    it('sets the transaction as sampled if the trace is chosen', function() {
      const payload = JSON.parse(tx.createDistributedTracePayload().text())
      expect(payload.d.sa).to.equal(tx.sampled)
      expect(payload.d.pr).to.equal(tx.priority)
    })

    it('adds the current span id as the parent span id', function() {
      agent.config.span_events.enabled = true
      agent.tracer.segment = tx.trace.root
      const payload = JSON.parse(tx.createDistributedTracePayload().text())
      expect(payload.d.id).to.equal(tx.trace.root.id)
      agent.tracer.segment = null
      agent.config.span_events.enabled = false
    })

    it('does not add the span id if the transaction is not sampled', function() {
      agent.config.span_events.enabled = true
      tx._calculatePriority()
      tx.sampled = false
      agent.tracer.segment = tx.trace.root
      const payload = JSON.parse(tx.createDistributedTracePayload().text())
      expect(payload.d.id).to.be.undefined
      agent.tracer.segment = null
      agent.config.span_events.enabled = false
    })

    it('returns stringified payload object', function() {
      const payload = tx.createDistributedTracePayload().text()
      expect(typeof payload).to.equal('string')
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/CreatePayload/Success'
      )
      expect(tx.isDistributedTrace).to.be.true
    })
  })

  describe('acceptTraceContextPayload', () => {
    it('should accept a valid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true
      agent.config.feature_flag.dt_format_w3c = true

      const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        txn.traceContext.acceptTraceContextPayload(goodParent, 'stuff')

        expect(txn.traceContext.traceparent).to.equal(goodParent)
        txn.end()
      })
    })

    it('should not accept invalid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true
      agent.config.feature_flag.dt_format_w3c = true

      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        const orig_traceparent = txn.traceContext.traceparent
        const traceparent = 'asdlkfjasdl;fkja'
        const tracestate = 'stuff'

        txn.traceContext.acceptTraceContextPayload(traceparent, tracestate)

        expect(txn.traceContext.traceparent).to.equal(orig_traceparent)
        txn.end()
      })
    })
  })

  describe('createTraceParentHeader', () => {
    it('should generate a valid new trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true
      agent.config.feature_flag.dt_format_w3c

      const tx = new Transaction(agent)

      agent.tracer.segment = tx.trace.root

      const traceparent = tx.traceContext.traceparent
      const traceparentParts = traceparent.split('-')

      const lowercaseHexRegex = /^[a-f0-9]+/

      expect(traceparentParts.length).to.equal(4)
      expect(traceparentParts[0], 'version').to.equal('00')
      expect(traceparentParts[1].length, 'traceId').to.equal(32)
      expect(traceparentParts[2].length, 'parentId').to.equal(16)
      expect(traceparentParts[3], 'flags').to.equal('00')

      expect(traceparentParts[1], 'traceId is lowercase hex').to.match(lowercaseHexRegex)
      expect(traceparentParts[2], 'parentId is lowercase hex').to.match(lowercaseHexRegex)

      agent.tracer.segment = null
    })

    it('should generate new parentId when spans_events disabled', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = false

      const tx = new Transaction(agent)
      const lowercaseHexRegex = /^[a-f0-9]+/

      agent.tracer.segment = tx.trace.root

      const traceparent = tx.traceContext.traceparent
      const traceparentParts = traceparent.split('-')

      expect(traceparentParts[2].length, 'parentId').to.equal(16)

      expect(traceparentParts[2], 'parentId is lowercase hex').to.match(lowercaseHexRegex)
    })

    it('should set traceparent sample part to 01 for sampled transaction', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const tx = new Transaction(agent)

      agent.tracer.segment = tx.trace.root
      tx.sampled = true

      const traceparent = tx.traceContext.traceparent
      const traceparentParts = traceparent.split('-')

      expect(traceparentParts[3], 'flags').to.equal('01')

      agent.tracer.segment = null
    })

    it('should set traceparent traceid if traceparent exists on transaction', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true
      agent.config.feature_flag.dt_format_w3c = true

      const tx = new Transaction(agent)
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = '323322332234234234423'

      tx.traceContext.acceptTraceContextPayload(traceparent, tracestate)

      agent.tracer.segment = tx.trace.root

      const traceparentParts = traceparent.split('-')

      expect(traceparentParts[1], 'traceId').to.equal('4bf92f3577b34da6a3ce929d0e0e4736')

      agent.tracer.segment = null
    })
  })

  describe('addDistributedTraceIntrinsics', function() {
    var tx = null
    var attributes = null

    beforeEach(function() {
      attributes = {}
      tx = new Transaction(agent)
    })

    it('generates a priority for entry-point transactions', () => {
      expect(tx.priority).to.equal(null)
      expect(tx.sampled).to.equal(null)

      tx.addDistributedTraceIntrinsics(attributes)

      expect(tx.priority).to.be.a('number')
      expect(tx.sampled).to.be.a('boolean')
    })

    it('does not change existing priority', () => {
      tx.priority = 999
      tx.sampled = false

      tx.addDistributedTraceIntrinsics(attributes)

      expect(tx.priority).to.equal(999)
      expect(tx.sampled).to.be.false
    })

    it('adds expected attributes if no payload was received', function() {
      tx.isDistributedTrace = false

      tx.addDistributedTraceIntrinsics(attributes)

      expect(attributes).to.have.property('guid', tx.id)
      expect(attributes).to.have.property('traceId', tx.id)
      expect(attributes).to.have.property('priority', tx.priority)
      expect(attributes).to.have.property('sampled', true)
    })

    it('adds DT attributes if payload was accepted', function() {
      tx.agent.config.account_id = '5678'
      tx.agent.config.primary_application_id = '1234'
      tx.agent.config.trusted_account_key = '5678'
      tx.agent.config.distributed_tracing.enabled = true

      const payload = tx.createDistributedTracePayload().text()
      tx.isDistributedTrace = false
      tx.acceptDistributedTracePayload(payload, 'AMQP')

      tx.addDistributedTraceIntrinsics(attributes)

      expect(attributes).to.have.property('parent.type', 'App')
      expect(attributes).to.have.property('parent.app', '1234')
      expect(attributes).to.have.property('parent.account', '5678')
      expect(attributes).to.have.property('parent.transportType', 'AMQP')
      expect(attributes).to.have.property('parent.transportDuration')
    })
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
