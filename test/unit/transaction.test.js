/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

const chai = require('chai')
const should = chai.should()
const expect = chai.expect
const helper = require('../lib/agent_helper')
const API = require('../../api')
const AttributeFilter = require('../../lib/config/attribute-filter')
const Metrics = require('../../lib/metrics')
const Trace = require('../../lib/transaction/trace')
const Transaction = require('../../lib/transaction')
const Segment = require('../../lib/transaction/trace/segment')
const hashes = require('../../lib/util/hashes')
const sinon = require('sinon')

describe('Transaction', function () {
  let agent = null
  let contextManager = null
  let trans = null

  beforeEach(function () {
    agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })
    contextManager = helper.getContextManager()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('should require an agent to create new transactions', function () {
    expect(function () {
      return new Transaction()
    }).throws(/must be bound to the agent/)
  })

  it('should create a trace on demand', function () {
    const trace = trans.trace
    expect(trace).instanceOf(Trace)
    expect(trans.trace).equal(trace)
  })

  it('should have at most one associated trace', function () {
    const trace = trans.trace
    expect(trace).not.instanceof(Array)
  })

  it('should hand its metrics off to the agent upon finalization', function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner.metrics).equal(trans.metrics)

      return done()
    })

    trans.end()
  })

  describe('when distributed tracing is enabled', function () {
    beforeEach(function () {
      agent.config.distributed_tracing.enabled = true
    })

    afterEach(function () {
      agent.config.distributed_tracing.enabled = false
    })

    it('should produce span events when finalizing', function (done) {
      agent.once('transactionFinished', function () {
        expect(agent.spanEventAggregator.length).to.equal(1)

        return done()
      })
      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.end()
      })
    })

    it('should not produce span events when ignored', function (done) {
      agent.once('transactionFinished', function () {
        expect(agent.spanEventAggregator.length).to.equal(0)

        return done()
      })

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.ignore = true
        txn.end()
      })
    })
  })

  it('should hand itself off to the agent upon finalization', function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner).equal(trans)

      return done()
    })

    trans.end()
  })

  describe('upon creation', function () {
    it('should have an ID', function () {
      should.exist(trans.id)
    })

    it('should have associated metrics', function () {
      should.exist(trans.metrics)
    })

    it('should be timing its duration', function () {
      return expect(trans.timer.isActive()).true
    })

    it('should have no associated URL (for hidden class)', function () {
      expect(trans.url).equal(null)
    })

    it('should have no name set (for hidden class)', function () {
      expect(trans.name).equal(null)
    })

    it('should have no PARTIAL name set (for hidden class)', function () {
      expect(trans.nameState.getName()).equal(null)
    })

    it('should have no HTTP status code set (for hidden class)', function () {
      expect(trans.statusCode).equal(null)
    })

    it('should have no error attached (for hidden class)', function () {
      expect(trans.error).equal(null)
    })

    it('should have no HTTP method / verb set (for hidden class)', function () {
      expect(trans.verb).equal(null)
    })

    it('should not be ignored by default (for hidden class)', function () {
      return expect(trans.ignore).false
    })

    it('should not have a sampled state set', function () {
      expect(trans.sampled).to.equal(null)
    })
  })

  describe('with associated metrics', function () {
    it('should manage its own independent of the agent', function () {
      expect(trans.metrics).instanceOf(Metrics)
      expect(trans.metrics).not.equal(getMetrics(agent))
    })

    it('should have the same apdex threshold as the agent', function () {
      expect(getMetrics(agent).apdexT).equal(trans.metrics.apdexT)
    })

    it('should have the same metrics mapper as the agent', function () {
      expect(agent.mapper).equal(trans.metrics.mapper)
    })
  })

  it('should know when it is not a web transaction', function () {
    const tx = new Transaction(agent)
    tx.type = Transaction.TYPES.BG
    expect(tx.isWeb()).to.be.false
  })

  it('should know when it is a web transaction', function () {
    const tx = new Transaction(agent)
    tx.type = Transaction.TYPES.WEB
    expect(tx.isWeb()).to.be.true
  })

  describe('when dealing with individual metrics', function () {
    it('should add metrics by name', function () {
      const tt = new Transaction(agent)

      tt.measure('Custom/Test01')
      should.exist(tt.metrics.getMetric('Custom/Test01'))

      tt.end()
    })

    it('should allow multiple overlapping metric measurements for same name', function () {
      const TRACE_NAME = 'Custom/Test06'
      const SLEEP_DURATION = 43
      const tt = new Transaction(agent)

      tt.measure(TRACE_NAME, null, SLEEP_DURATION)
      tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5)

      const statistics = tt.metrics.getMetric(TRACE_NAME)
      expect(statistics.callCount).to.equal(2)
      expect(statistics.max).above((SLEEP_DURATION - 1) / 1000)
    })

    it('should allow manual setting of metric durations', function () {
      const tt = new Transaction(agent)

      tt.measure('Custom/Test16', null, 65)
      tt.end()

      const metrics = tt.metrics.getMetric('Custom/Test16')
      expect(metrics.total).equal(0.065)
    })
  })

  describe('when being named', function () {
    beforeEach(function () {
      agent.config.attributes.enabled = true
      agent.config.attributes.include = ['request.parameters.*']
      agent.config.emit('attributes.include')

      trans = new Transaction(agent)
    })

    describe('getName', function () {
      it('should return `null` if there is no name, partialName, or url', function () {
        expect(trans.getName()).to.be.null
      })

      it('partial name should remain unset if it was not set before', function () {
        trans.url = '/some/pathname'
        expect(trans.nameState.getName()).to.be.null
        expect(trans.getName()).to.equal('NormalizedUri/*')
        expect(trans.nameState.getName()).to.be.null
      })

      it('should return the right name if partialName and url are set', function () {
        trans.nameState.setPrefix('Framework')
        trans.nameState.setVerb('verb')
        trans.nameState.appendPath('route')
        trans.url = '/route'
        expect(trans.getName()).to.equal('WebFrameworkUri/Framework/VERB/route')
        expect(trans.nameState.getName()).to.equal('Framework/VERB/route')
      })

      it('should return the name if it has already been set', function () {
        trans.setPartialName('foo/bar')
        expect(trans.getName()).equal('foo/bar')
      })
    })

    describe('isIgnored', function () {
      it('should return true if a transaction is ignored by a rule', function () {
        const api = new API(agent)
        api.addIgnoringRule('^/test/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.isIgnored()).true
      })
    })

    describe('getFullName', function () {
      it('should return null if it does not have name, partialName, or url', function () {
        expect(trans.getFullName()).equal(null)
      })

      it('partial name should remain unset if it was not set before', function () {
        trans.url = '/some/pathname'
        expect(trans.nameState.getName()).to.equal(null)
        expect(trans.getFullName()).to.equal('WebTransaction/NormalizedUri/*')
        expect(trans.nameState.getName()).to.equal(null)
      })

      it('should return the right name if partialName and url are set', function () {
        trans.nameState.setPrefix('Framework')
        trans.nameState.setVerb('verb')
        trans.nameState.appendPath('route')
        trans.url = '/route'
        expect(trans.getFullName()).to.equal('WebTransaction/WebFrameworkUri/Framework/VERB/route')
        expect(trans.nameState.getName()).to.equal('Framework/VERB/route')
      })

      it('should return the name if it has already been set', function () {
        trans.name = 'OtherTransaction/foo/bar'
        expect(trans.getFullName()).to.equal('OtherTransaction/foo/bar')
      })

      it('should return the forced name if set', function () {
        trans.name = 'FullName'
        trans._partialName = 'PartialName'
        trans.forceName = 'ForcedName'
        expect(trans.getFullName()).to.equal('WebTransaction/ForcedName')
      })
    })

    describe('with no partial name set', function () {
      it('produces a normalized (backstopped) name when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it('produces a normalized partial name when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans._partialName).equal('NormalizedUri/*')
      })

      it('passes through status code when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it('produces a non-error name when status code is ignored', function () {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans.name).equal('WebTransaction/NormalizedUri/*')
      })

      it('produces a non-error partial name when status code is ignored', function () {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans._partialName).equal('NormalizedUri/*')
      })

      it('passes through status code when status is 404', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it('produces a `not found` partial name when status is 404', function () {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans._partialName).equal('Expressjs/GET/(not found)')
      })

      it('produces a `not found` name when status is 404', function () {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.name).equal('WebTransaction/Expressjs/GET/(not found)')
      })

      it('passes through status code when status is 405', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans.statusCode).equal(405)
      })

      it('produces a `method not allowed` partial name when status is 405', function () {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans._partialName).equal('Expressjs/GET/(method not allowed)')
      })

      it('produces a `method not allowed` name when status is 405', function () {
        trans.nameState.setName('Expressjs', 'GET', '/')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
        expect(trans.name).equal('WebTransaction/Expressjs/GET/(method not allowed)')
      })

      it('produces a name based on 501 status code message', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/WebFrameworkUri/(not implemented)')
      })

      it('produces a regular partial name based on 501 status code message', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans._partialName).equal('WebFrameworkUri/(not implemented)')
      })

      it('passes through status code when status is 501', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })
    })

    describe('with a custom partial name set', function () {
      beforeEach(function () {
        trans.nameState.setPrefix('Custom')
        trans.nameState.appendPath('test')
      })

      it('produces a custom name when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('produces a partial name when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('should rename a transaction when told to by a rule', function () {
        agent.transactionNameNormalizer.addSimple('^(WebTransaction/Custom)/test$', '$1/*')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.name).equal('WebTransaction/Custom/*')
      })

      it('passes through status code when status is 200', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        expect(trans.statusCode).equal(200)
      })

      it('keeps the custom name when error status is ignored', function () {
        agent.config.error_collector.ignore_status_codes = [404, 500]
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('keeps the custom partial name when error status is ignored', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('passes through status code when status is 404', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
        expect(trans.statusCode).equal(404)
      })

      it('produces the custom name even when status is 501', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.name).equal('WebTransaction/Custom/test')
      })

      it('produces the custome partial name even when status is 501', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.nameState.getName()).equal('Custom/test')
      })

      it('passes through status code when status is 501', function () {
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
        expect(trans.statusCode).equal(501)
      })

      it('should ignore a transaction when told to by a rule', function () {
        agent.transactionNameNormalizer.addSimple('^WebTransaction/Custom/test$')
        trans.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
        return expect(trans.isIgnored()).true
      })
    })
  })

  describe('when setting apdex for key transactions', function () {
    let tx = null
    let metric = null

    before(function () {
      tx = new Transaction(agent)
      tx._setApdex('Apdex/TestController/key', 1200, 667)

      metric = tx.metrics.getMetric('Apdex/TestController/key')
    })

    it('should set apdexT to the key transaction apdexT', function () {
      expect(metric.apdexT).equal(0.667)
    })

    it('should not have satisfied', function () {
      expect(metric.satisfying).equal(0)
    })

    it('should have been tolerated', function () {
      expect(metric.tolerating).equal(1)
    })

    it('should not have frustrated', function () {
      expect(metric.frustrating).equal(0)
    })

    it('should not require a key transaction apdexT', function () {
      tx._setApdex('Apdex/TestController/another', 1200)
      const another = tx.metrics.getMetric('Apdex/TestController/another')
      expect(another.apdexT).equal(0.1)
    })
  })

  describe('when producing a summary of the whole transaction', function () {
    it('should produce a human-readable summary')
    it('should produce a metrics summary suitable for the collector')
  })

  it('should not scope web transactions to their URL', function () {
    const tx = new Transaction(agent)
    tx.finalizeNameFromUri('/test/1337?action=edit', 200)
    expect(tx.name).not.equal('/test/1337?action=edit')
    expect(tx.name).not.equal('WebTransaction/Uri/test/1337')
  })

  describe('pathHashes', function () {
    let transaction

    beforeEach(function () {
      transaction = new Transaction(agent)
    })

    it('should add up to 10 items to to pathHashes', function () {
      const toAdd = ['1', '2', '3', '4', '4', '5', '6', '7', '8', '9', '10', '11']
      const expected = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

      toAdd.forEach(transaction.pushPathHash.bind(transaction))
      expect(transaction.pathHashes).deep.equal(expected)
    })

    it('should not include current pathHash in alternatePathHashes', function () {
      transaction.name = '/a/b/c'
      transaction.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
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

    it('should return null when no alternate pathHashes exist', function () {
      transaction.nameState.setPrefix('/a/b/c')
      transaction.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
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

  describe('hasErrors', function () {
    let transaction

    beforeEach(function () {
      transaction = new Transaction(agent)
    })

    it('should return true if exceptions property is not empty', function () {
      expect(transaction.hasErrors()).to.be.false
      transaction.exceptions.push(new Error())
      expect(transaction.hasErrors()).to.be.true
    })

    it('should return true if statusCode is an error', function () {
      transaction.statusCode = 500
      expect(transaction.hasErrors()).to.be.true
    })
  })

  describe('isSampled', function () {
    let transaction

    beforeEach(function () {
      transaction = new Transaction(agent)
    })

    it('should be true when the transaction is sampled', function () {
      // the first 10 transactions are sampled so this should be true
      expect(transaction.isSampled()).to.be.true
    })

    it('should be false when the transaction is not sampled', function () {
      transaction.priority = Infinity
      transaction.sampled = false
      expect(transaction.isSampled()).to.be.false
    })
  })

  describe('getIntrinsicAttributes', function () {
    let transaction

    beforeEach(function () {
      transaction = new Transaction(agent)
    })

    it('includes CAT attributes when enabled', function () {
      transaction.agent.config.cross_application_tracer.enabled = true
      transaction.agent.config.distributed_tracing.enabled = false
      transaction.tripId = '3456'
      transaction.referringTransactionGuid = '1234'
      transaction.incomingCatId = '2345'

      const attributes = transaction.getIntrinsicAttributes()
      expect(attributes.referring_transaction_guid).equal('1234')
      expect(attributes.client_cross_process_id).equal('2345')
      expect(attributes.path_hash).to.be.a('string')
      expect(attributes.trip_id).equal('3456')
    })

    it('includes Synthetics attributes', function () {
      transaction.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      const attributes = transaction.getIntrinsicAttributes()
      expect(attributes.synthetics_resource_id).equal('resId')
      expect(attributes.synthetics_job_id).equal('jobId')
      expect(attributes.synthetics_monitor_id).equal('monId')
    })

    it('returns different object every time', function () {
      expect(transaction.getIntrinsicAttributes()).to.not.equal(
        transaction.getIntrinsicAttributes()
      )
    })

    it('includes distributed trace attributes', function () {
      const attributes = transaction.getIntrinsicAttributes()
      expect(transaction.priority.toString().length).to.be.at.most(8)

      expect(attributes).to.have.property('guid', transaction.id)
      expect(attributes).to.have.property('traceId', transaction.traceId)
      expect(attributes).to.have.property('priority', transaction.priority)
      expect(attributes).to.have.property('sampled', true)
    })
  })

  describe('getResponseDurationInMillis', function () {
    let transaction

    beforeEach(function () {
      transaction = new Transaction(agent)
    })

    describe('for web transactions', function () {
      it('should use the time until transaction.end() is called', function () {
        transaction.url = 'someUrl'

        // add a segment that will end after the transaction ends
        const childSegment = transaction.trace.add('child')
        childSegment.start()

        transaction.end()
        childSegment.end()

        // response time should equal the transaction timer duration
        expect(transaction.getResponseTimeInMillis()).to.equal(
          transaction.timer.getDurationInMillis()
        )
      })
    })

    describe('for background transactions', function () {
      it('should report response time equal to trace duration', function () {
        // add a segment that will end after the transaction ends
        transaction.type = Transaction.TYPES.BG
        const bgTransactionSegment = transaction.trace.add('backgroundWork')
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

  describe('_acceptDistributedTracePayload', function () {
    let tx = null

    beforeEach(function () {
      agent.recordSupportability = sinon.spy()
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'

      // Clear deprecated values just to be extra sure.
      agent.config.cross_process_id = null
      agent.config.trusted_account_ids = null

      tx = new Transaction(agent)
    })

    afterEach(function () {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('records supportability metric if no payload was passed', function () {
      tx._acceptDistributedTracePayload(null)
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Ignored/Null'
      )
    })

    describe('when already marked as distributed trace', function () {
      it('records `Multiple` supportability metric if parentId exists', function () {
        tx.isDistributedTrace = true
        tx.parentId = 'exists'

        tx._acceptDistributedTracePayload({})
        expect(tx.agent.recordSupportability.args[0][0]).to.equal(
          'DistributedTrace/AcceptPayload/Ignored/Multiple'
        )
      })

      it('records `CreateBeforeAccept` metric if parentId does not exist', function () {
        tx.isDistributedTrace = true

        tx._acceptDistributedTracePayload({})
        expect(tx.agent.recordSupportability.args[0][0]).to.equal(
          'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
        )
      })
    })

    it('should not accept payload if no configured trusted key', function () {
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

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })

      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Exception'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should not accept payload if DT disabled', function () {
      tx.agent.config.distributed_tracing.enabled = false

      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })

      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Exception'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should accept payload if config valid and CAT disabled', function () {
      tx.agent.config.cross_application_tracer.enabled = false

      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })

      expect(tx.isDistributedTrace).to.be.true
    })

    it('fails if payload version is above agent-supported version', function () {
      tx._acceptDistributedTracePayload({ v: [1, 0] })
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/ParseException'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('fails if payload account id is not in trusted ids', function () {
      const data = {
        ac: 2,
        ty: 'App',
        id: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now()
      }

      tx._acceptDistributedTracePayload({
        v: [0, 1],
        d: data
      })
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Ignored/UntrustedAccount'
      )
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('fails if payload data is missing required keys', function () {
      tx._acceptDistributedTracePayload({
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

    it('takes the priority and sampled state from the incoming payload', function () {
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

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })
      expect(tx.sampled).to.be.true
      expect(tx.priority).to.equal(data.pr)
      // Should not truncate accepted priority
      expect(tx.priority.toString().length).to.equal(9)
    })

    it('does not take the distributed tracing data if priority is missing', function () {
      const data = {
        ac: 1,
        ty: 'App',
        id: tx.id,
        tr: tx.id,
        ap: 'test',
        sa: true,
        ti: Date.now()
      }

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })
      expect(tx.priority).to.equal(null)
      expect(tx.sampled).to.equal(null)
    })

    it('stores payload props on transaction', function () {
      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() - 1
      }

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/Success'
      )
      expect(tx.parentId).to.equal(data.tx)
      expect(tx.parentType).to.equal(data.ty)
      expect(tx.traceId).to.equal(data.tr)
      expect(tx.isDistributedTrace).to.be.true
      expect(tx.parentTransportDuration).to.be.greaterThan(0)
    })

    it('should 0 transport duration when receiving payloads from the future', function () {
      const data = {
        ac: '1',
        ty: 'App',
        tx: tx.id,
        id: tx.trace.root.id,
        tr: tx.id,
        ap: 'test',
        ti: Date.now() + 1000
      }

      tx._acceptDistributedTracePayload({ v: [0, 1], d: data })
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

  describe('_getParsedPayload', function () {
    let tx = null
    let payload = null

    beforeEach(function () {
      agent.recordSupportability = sinon.spy()
      tx = new Transaction(agent)
      payload = JSON.stringify({
        test: 'payload'
      })
    })

    afterEach(function () {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('returns parsed JSON object', function () {
      const res = tx._getParsedPayload(payload)
      expect(res).to.deep.equal({ test: 'payload' })
    })

    it('returns parsed object from base64 string', function () {
      tx.agent.config.encoding_key = 'test'

      const res = tx._getParsedPayload(payload.toString('base64'))
      expect(res).to.deep.equal({ test: 'payload' })
    })

    it('returns null if string is invalid JSON', function () {
      const res = tx._getParsedPayload('{invalid JSON string}')
      expect(res).to.be.null
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/AcceptPayload/ParseException'
      )
    })

    it('returns null if decoding fails', function () {
      tx.agent.config.encoding_key = 'test'
      payload = hashes.obfuscateNameUsingKey(payload, 'some other key')

      const res = tx._getParsedPayload(payload)
      expect(res).to.be.null
    })
  })

  describe('_createDistributedTracePayload', function () {
    let tx = null

    beforeEach(function () {
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

    afterEach(function () {
      agent.recordSupportability.restore && agent.recordSupportability.restore()
    })

    it('should not create payload when DT disabled', function () {
      tx.agent.config.distributed_tracing.enabled = false

      const payload = tx._createDistributedTracePayload().text()
      expect(payload).to.equal('')
      expect(tx.agent.recordSupportability.callCount).to.equal(0)
      expect(tx.isDistributedTrace).to.not.be.true
    })

    it('should create payload when DT enabled and CAT disabled', function () {
      tx.agent.config.cross_application_tracer.enabled = false

      const payload = tx._createDistributedTracePayload().text()

      expect(payload).to.not.be.null
      expect(payload).to.not.equal('')
    })

    it('does not change existing priority', () => {
      tx.priority = 999
      tx.sampled = false

      tx._createDistributedTracePayload()

      expect(tx.priority).to.equal(999)
      expect(tx.sampled).to.be.false
    })

    it('sets the transaction as sampled if the trace is chosen', function () {
      const payload = JSON.parse(tx._createDistributedTracePayload().text())
      expect(payload.d.sa).to.equal(tx.sampled)
      expect(payload.d.pr).to.equal(tx.priority)
    })

    it('adds the current span id as the parent span id', function () {
      agent.config.span_events.enabled = true
      contextManager.setContext(tx.trace.root)
      tx.sampled = true
      const payload = JSON.parse(tx._createDistributedTracePayload().text())
      expect(payload.d.id).to.equal(tx.trace.root.id)
      contextManager.setContext(null)
      agent.config.span_events.enabled = false
    })

    it('does not add the span id if the transaction is not sampled', function () {
      agent.config.span_events.enabled = true
      tx._calculatePriority()
      tx.sampled = false
      contextManager.setContext(tx.trace.root)
      const payload = JSON.parse(tx._createDistributedTracePayload().text())
      expect(payload.d.id).to.be.undefined
      contextManager.setContext(null)
      agent.config.span_events.enabled = false
    })

    it('returns stringified payload object', function () {
      const payload = tx._createDistributedTracePayload().text()
      expect(typeof payload).to.equal('string')
      expect(tx.agent.recordSupportability.args[0][0]).to.equal(
        'DistributedTrace/CreatePayload/Success'
      )
      expect(tx.isDistributedTrace).to.be.true
    })
  })

  describe('acceptDistributedTraceHeaders', () => {
    it('should accept a valid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      const headers = {
        traceparent: goodParent
      }

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptDistributedTraceHeaders('HTTP', headers)

        expect(txn.traceId).to.equal('4bf92f3577b34da6a3ce929d0e0e4736')
        expect(txn.parentSpanId).to.equal('00f067aa0ba902b7')

        txn.end()
      })
    })

    it('should not accept invalid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const originalHeaders = createHeadersAndInsertTrace(txn)

        const origTraceparent = originalHeaders.traceparent
        const traceparent = 'asdlkfjasdl;fkja'
        const tracestate = 'stuff'

        const headers = {
          traceparent,
          tracestate
        }

        txn.acceptDistributedTraceHeaders('HTTP', headers)

        const secondHeaders = createHeadersAndInsertTrace(txn)

        expect(secondHeaders.traceparent).to.equal(origTraceparent)
        txn.end()
      })
    })

    it('should use newrelic format when no traceparent', () => {
      const trustedAccountKey = '123'

      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = trustedAccountKey
      agent.config.span_events.enabled = true

      const incomingTraceId = '6e2fea0b173fdad0'
      const expectedTraceId = '0000000000000000' + incomingTraceId

      const newrelicDtData = {
        v: [0, 1],
        d: {
          ty: 'Mobile',
          ac: trustedAccountKey,
          ap: '51424',
          id: '5f474d64b9cc9b2a',
          tr: incomingTraceId,
          pr: 0.1234,
          sa: true,
          ti: '1482959525577',
          tx: '27856f70d3d314b7'
        }
      }

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const headers = {
          newrelic: JSON.stringify(newrelicDtData)
        }

        txn.acceptDistributedTraceHeaders('HTTP', headers)

        expect(txn.isDistributedTrace).to.be.true
        expect(txn.acceptedDistributedTrace).to.be.true

        const outboundHeaders = createHeadersAndInsertTrace(txn)
        const splitData = outboundHeaders.traceparent.split('-')
        const [, traceId] = splitData

        expect(traceId).to.equal(expectedTraceId)
        txn.end()
      })
    })

    it('should not throw error when headers is a string', () => {
      const trustedAccountKey = '123'

      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = trustedAccountKey
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const headers = 'JUST A STRING'

        expect(function () {
          txn.acceptDistributedTraceHeaders('HTTP', headers)
        }).not.throws()

        expect(txn.isDistributedTrace).to.be.null
        expect(txn.acceptedDistributedTrace).to.be.null

        txn.end()
      })
    })

    it('should only accept the first tracecontext', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const expectedTraceId = 'da8bc8cc6d062849b0efcf3c169afb5a'
      const expectedParentSpanId = '7d3efb1b173fecfa'
      const expectedAppId = '2827902'

      const firstTraceContext = {
        traceparent: `00-${expectedTraceId}-${expectedParentSpanId}-01`,
        tracestate: `1@nr=0-0-1-${expectedAppId}-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035`
      }

      const secondTraceContext = {
        traceparent: '00-37375fc353f345b5801b166e31b76136-b4a07f08064ee8f9-00',
        tracestate: '1@nr=0-0-1-3837903-b4a07f08064ee8f9-e8b91a159289ff74-0-0.123456-1518469636035'
      }

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptDistributedTraceHeaders('HTTP', firstTraceContext)
        txn.acceptDistributedTraceHeaders('HTTP', secondTraceContext)

        expect(txn.traceId).to.equal(expectedTraceId)
        expect(txn.parentSpanId).to.equal(expectedParentSpanId)
        expect(txn.parentApp).to.equal('2827902')

        txn.end()
      })
    })

    it('should not accept tracecontext after sending a trace', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const unexpectedTraceId = 'da8bc8cc6d062849b0efcf3c169afb5a'
      const unexpectedParentSpanId = '7d3efb1b173fecfa'
      const unexpectedAppId = '2827902'

      const firstTraceContext = {
        traceparent: `00-${unexpectedTraceId}-${unexpectedParentSpanId}-01`,
        tracestate: `1@nr=0-0-1-${unexpectedAppId}-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035`
      }

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const outboundHeaders = {}
        txn.insertDistributedTraceHeaders(outboundHeaders)

        txn.acceptDistributedTraceHeaders('HTTP', firstTraceContext)

        expect(txn.traceId).to.not.equal(unexpectedTraceId)
        expect(txn.parentSpanId).to.not.equal(unexpectedParentSpanId)
        expect(txn.parentApp).to.not.equal('2827902')

        const traceparentParts = outboundHeaders.traceparent.split('-')
        const [, expectedTraceId] = traceparentParts

        expect(txn.traceId).to.equal(expectedTraceId)

        txn.end()
      })
    })
  })

  describe('insertDistributedTraceHeaders', () => {
    it('should lowercase traceId for tracecontext when recieved upper from newrelic format', () => {
      const trustedAccountKey = '123'

      agent.config.account_id = 'AccountId1'
      agent.config.primary_application_id = 'Application1'
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = trustedAccountKey
      agent.config.span_events.enabled = true

      const incomingTraceId = '6E2fEA0B173FDAD0'
      const expectedTraceContextTraceId = '0000000000000000' + incomingTraceId.toLowerCase()

      const newrelicDtData = {
        v: [0, 1],
        d: {
          ty: 'Mobile',
          ac: trustedAccountKey,
          ap: '51424',
          id: '5f474d64b9cc9b2a',
          tr: incomingTraceId,
          pr: 0.1234,
          sa: true,
          ti: '1482959525577',
          tx: '27856f70d3d314b7'
        }
      }

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const headers = {
          newrelic: JSON.stringify(newrelicDtData)
        }

        txn.acceptDistributedTraceHeaders('HTTP', headers)

        expect(txn.isDistributedTrace).to.be.true
        expect(txn.acceptedDistributedTrace).to.be.true

        const insertedHeaders = {}
        txn.insertDistributedTraceHeaders(insertedHeaders)

        const splitData = insertedHeaders.traceparent.split('-')
        const [, traceId] = splitData

        expect(traceId).to.equal(expectedTraceContextTraceId)

        const rawPayload = Buffer.from(insertedHeaders.newrelic, 'base64').toString('utf-8')
        const payload = JSON.parse(rawPayload)

        // newrelic header should have traceId untouched
        expect(payload.d.tr).to.equal(incomingTraceId)

        // traceId used for metrics shoudl go untouched
        expect(txn.traceId).to.equal(incomingTraceId)

        txn.end()
      })
    })

    it('should generate a valid new trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const tx = new Transaction(agent)

      contextManager.setContext(tx.trace.root)

      const outboundHeaders = createHeadersAndInsertTrace(tx)
      const traceparent = outboundHeaders.traceparent
      const traceparentParts = traceparent.split('-')

      const lowercaseHexRegex = /^[a-f0-9]+/

      expect(traceparentParts.length).to.equal(4)
      expect(traceparentParts[0], 'version').to.equal('00')
      expect(traceparentParts[1].length, 'traceId').to.equal(32)
      expect(traceparentParts[2].length, 'parentId').to.equal(16)
      expect(traceparentParts[3], 'flags').to.equal('01')

      expect(traceparentParts[1], 'traceId is lowercase hex').to.match(lowercaseHexRegex)
      expect(traceparentParts[2], 'parentId is lowercase hex').to.match(lowercaseHexRegex)

      contextManager.setContext(null)
    })

    it('should generate new parentId when spans_events disabled', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = false

      const tx = new Transaction(agent)
      const lowercaseHexRegex = /^[a-f0-9]+/

      contextManager.setContext(tx.trace.root)

      const outboundHeaders = createHeadersAndInsertTrace(tx)
      const traceparent = outboundHeaders.traceparent
      const traceparentParts = traceparent.split('-')

      expect(traceparentParts[2].length, 'parentId').to.equal(16)

      expect(traceparentParts[2], 'parentId is lowercase hex').to.match(lowercaseHexRegex)
    })

    it('should set traceparent sample part to 01 for sampled transaction', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const tx = new Transaction(agent)

      contextManager.setContext(tx.trace.root)
      tx.sampled = true

      const outboundHeaders = createHeadersAndInsertTrace(tx)
      const traceparent = outboundHeaders.traceparent
      const traceparentParts = traceparent.split('-')

      expect(traceparentParts[3], 'flags').to.equal('01')

      contextManager.setContext(null)
    })

    it('should set traceparent traceid if traceparent exists on transaction', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const tx = new Transaction(agent)
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = '323322332234234234423'

      tx.acceptTraceContextPayload(traceparent, tracestate)

      contextManager.setContext(tx.trace.root)

      const outboundHeaders = createHeadersAndInsertTrace(tx)
      const traceparentParts = outboundHeaders.traceparent.split('-')

      expect(traceparentParts[1], 'traceId').to.equal('4bf92f3577b34da6a3ce929d0e0e4736')

      contextManager.setContext(null)
    })

    it('generates a priority for entry-point transactions', () => {
      const tx = new Transaction(agent)

      expect(tx.priority).to.equal(null)
      expect(tx.sampled).to.equal(null)

      tx.insertDistributedTraceHeaders({})

      expect(tx.priority).to.be.a('number')
      expect(tx.sampled).to.be.a('boolean')
    })
  })

  describe('acceptTraceContextPayload', () => {
    it('should accept a valid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(goodParent, 'stuff')

        expect(txn.traceId).to.equal('4bf92f3577b34da6a3ce929d0e0e4736')
        expect(txn.parentSpanId).to.equal('00f067aa0ba902b7')

        txn.end()
      })
    })

    it('should not accept invalid trace context traceparent header', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.trusted_account_key = '1'
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const originalHeaders = createHeadersAndInsertTrace(txn)
        const origTraceparent = originalHeaders.traceparent
        const traceparent = 'asdlkfjasdl;fkja'
        const tracestate = 'stuff'

        txn.acceptTraceContextPayload(traceparent, tracestate)

        const secondHeaders = createHeadersAndInsertTrace(txn)

        expect(secondHeaders.traceparent).to.equal(origTraceparent)
        txn.end()
      })
    })

    it('should not accept tracestate when trusted_account_key missing', () => {
      agent.config.trusted_account_key = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      // When two bugs combine, we might accept a tracestate we shouldn't
      const incomingNullKeyedTracestate =
        'null@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(incomingTraceparent, incomingNullKeyedTracestate)

        // traceparent
        expect(txn.traceId).to.equal('4bf92f3577b34da6a3ce929d0e0e4736')
        expect(txn.parentSpanId).to.equal('00f067aa0ba902b7')

        // tracestate
        expect(txn.parentType).to.not.exist
        expect(txn.accountId).to.not.exist
        expect(txn.parentApp).to.not.exist
        expect(txn.parentId).to.not.exist

        txn.end()
      })
    })

    it('should accept tracestate when trusted_account_key matches', () => {
      agent.config.trusted_account_key = '33'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      // When two bugs combine, we might accept a tracestate we shouldn't
      const incomingNullKeyedTracestate =
        '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(incomingTraceparent, incomingNullKeyedTracestate)

        // traceparent
        expect(txn.traceId).to.equal('4bf92f3577b34da6a3ce929d0e0e4736')
        expect(txn.parentSpanId).to.equal('00f067aa0ba902b7')

        // tracestate
        expect(txn.parentType).to.equal('App')
        expect(txn.parentAcct).to.equal('33')
        expect(txn.parentApp).to.equal('2827902')
        expect(txn.parentId).to.equal('e8b91a159289ff74')

        txn.end()
      })
    })
  })

  describe('addDistributedTraceIntrinsics', function () {
    let tx = null
    let attributes = null

    beforeEach(function () {
      attributes = {}
      tx = new Transaction(agent)
    })

    it('does not change existing priority', () => {
      tx.priority = 999
      tx.sampled = false

      tx.addDistributedTraceIntrinsics(attributes)

      expect(tx.priority).to.equal(999)
      expect(tx.sampled).to.be.false
    })

    it('adds expected attributes if no payload was received', function () {
      tx.isDistributedTrace = false

      tx.addDistributedTraceIntrinsics(attributes)

      expect(attributes).to.have.property('guid', tx.id)
      expect(attributes).to.have.property('traceId', tx.traceId)
      expect(attributes).to.have.property('priority', tx.priority)
      expect(attributes).to.have.property('sampled', true)
    })

    it('adds DT attributes if payload was accepted', function () {
      tx.agent.config.account_id = '5678'
      tx.agent.config.primary_application_id = '1234'
      tx.agent.config.trusted_account_key = '5678'
      tx.agent.config.distributed_tracing.enabled = true

      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = false
      tx._acceptDistributedTracePayload(payload, 'AMQP')

      tx.addDistributedTraceIntrinsics(attributes)

      expect(attributes).to.have.property('parent.type', 'App')
      expect(attributes).to.have.property('parent.app', '1234')
      expect(attributes).to.have.property('parent.account', '5678')
      expect(attributes).to.have.property('parent.transportType', 'AMQP')
      expect(attributes).to.have.property('parent.transportDuration')
    })
  })
})

tap.test('transaction end', (t) => {
  t.autoend()

  let agent = null
  let transaction = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })

    transaction = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)

    agent = null
    transaction = null
  })

  t.test('should clear errors', (t) => {
    transaction.userErrors.push(new Error('user sadness'))
    transaction.exceptions.push(new Error('things went bad'))

    transaction.end()

    t.equal(transaction.userErrors, null)
    t.equal(transaction.exceptions, null)

    t.end()
  })

  t.test('should not clear errors until after transactionFinished event', (t) => {
    transaction.userErrors.push(new Error('user sadness'))
    transaction.exceptions.push(new Error('things went bad'))

    agent.on('transactionFinished', (endedTransaction) => {
      t.equal(endedTransaction.userErrors.length, 1)
      t.equal(endedTransaction.exceptions.length, 1)

      t.end()
    })

    transaction.end()
  })
})

tap.test('when being named with finalizeNameFromUri', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null
  let transaction = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })
    contextManager = helper.getContextManager()

    transaction = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)

    agent = null
    transaction = null
  })

  t.test('should throw when called with no parameters', (t) => {
    t.throws(() => transaction.finalizeNameFromUri())

    t.end()
  })

  t.test('should ignore a request path when told to by a rule', (t) => {
    const api = new API(agent)
    api.addIgnoringRule('^/test/')

    transaction.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)

    t.equal(transaction.isIgnored(), true)

    t.end()
  })

  t.test('should ignore a transaction when told to by a rule', (t) => {
    agent.transactionNameNormalizer.addSimple('^WebTransaction/NormalizedUri')

    transaction.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)

    t.equal(transaction.isIgnored(), true)

    t.end()
  })

  t.test('should pass through a name when told to by a rule', (t) => {
    agent.userNormalizer.addSimple('^/config', '/foobar')

    transaction.finalizeNameFromUri('/config', 200)

    t.equal(transaction.name, 'WebTransaction/NormalizedUri/foobar')

    t.end()
  })

  t.test('should add finalized via rule transaction name to active span intrinsics', (t) => {
    agent.userNormalizer.addSimple('^/config', '/foobar')

    addSegmentInContext(contextManager, transaction, 'test segment')

    transaction.finalizeNameFromUri('/config', 200)

    const spanContext = agent.tracer.getSpanContext()
    const intrinsics = spanContext.intrinsicAttributes

    t.ok(intrinsics)
    t.equal(intrinsics['transaction.name'], 'WebTransaction/NormalizedUri/foobar')

    t.end()
  })

  t.test('when namestate populated should use name stack', (t) => {
    setupNameState(transaction)

    transaction.finalizeNameFromUri('/some/random/path', 200)

    t.equal(transaction.name, 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')

    t.end()
  })

  t.test('when namestate populated should copy parameters from the name stack', (t) => {
    setupNameState(transaction)

    transaction.finalizeNameFromUri('/some/random/path', 200)

    const attrs = transaction.trace.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE)

    t.match(attrs, {
      'request.parameters.foo': 'biz',
      'request.parameters.bar': 'bang'
    })

    t.end()
  })

  t.test(
    'when namestate populated, ' +
      'should add finalized via rule transaction name to active span intrinsics',
    (t) => {
      setupNameState(transaction)
      addSegmentInContext(contextManager, transaction, 'test segment')

      transaction.finalizeNameFromUri('/some/random/path', 200)

      const spanContext = agent.tracer.getSpanContext()
      const intrinsics = spanContext.intrinsicAttributes

      t.ok(intrinsics)
      t.equal(intrinsics['transaction.name'], 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')

      t.end()
    }
  )

  t.test('when namestate populated and high_security enabled, should use name stack', (t) => {
    setupNameState(transaction)
    setupHighSecurity(agent)

    transaction.finalizeNameFromUri('/some/random/path', 200)

    t.equal(transaction.name, 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')

    t.end()
  })

  t.test(
    'when namestate populated and high_security enabled, ' +
      'should not copy parameters from the name stack',
    (t) => {
      setupNameState(transaction)
      setupHighSecurity(agent)

      transaction.finalizeNameFromUri('/some/random/path', 200)

      const attrs = transaction.trace.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE)
      expect(attrs).to.deep.equal({})

      t.end()
    }
  )
})

tap.test('requestd', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null
  let transaction = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      span_events: {
        enabled: true,
        attributes: {
          include: ['request.parameters.*']
        }
      },
      distributed_tracing: {
        enabled: true
      }
    })

    contextManager = helper.getContextManager()

    transaction = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)

    agent = null
    transaction = null
  })

  t.test('when namestate populated should copy parameters from the name stack', (t) => {
    setupNameState(transaction)

    addSegmentInContext(contextManager, transaction, 'test segment')

    transaction.finalizeNameFromUri('/some/random/path', 200)

    const segment = contextManager.getContext()

    t.match(segment.attributes.get(AttributeFilter.DESTINATIONS.SPAN_EVENT), {
      'request.parameters.foo': 'biz',
      'request.parameters.bar': 'bang'
    })

    t.end()
  })
})

tap.test('when being named with finalizeName', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null
  let transaction = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })

    contextManager = helper.getContextManager()
    transaction = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)

    agent = null
    transaction = null
  })

  t.test('should call finalizeNameFromUri if no name is given for a web tx', (t) => {
    let called = false

    transaction.finalizeNameFromUri = function () {
      called = true
    }
    transaction.type = 'web'
    transaction.url = '/foo/bar'
    transaction.finalizeName()

    t.ok(called)

    t.end()
  })

  t.test('should apply ignore rules', (t) => {
    agent.transactionNameNormalizer.addSimple('foo') // Ignore foo

    transaction.finalizeName('foo')

    t.equal(transaction.isIgnored(), true)

    t.end()
  })

  t.test('should not apply user naming rules', (t) => {
    agent.userNormalizer.addSimple('^/config', '/foobar')

    transaction.finalizeName('/config')

    t.equal(transaction.getFullName(), 'WebTransaction//config')

    t.end()
  })

  t.test('should add finalized transaction name to active span intrinsics', (t) => {
    addSegmentInContext(contextManager, transaction, 'test segment')

    transaction.finalizeName('/config')

    const spanContext = agent.tracer.getSpanContext()
    const intrinsics = spanContext.intrinsicAttributes

    t.ok(intrinsics)
    t.equal(intrinsics['transaction.name'], 'WebTransaction//config')

    t.end()
  })
})

function setupNameState(transaction) {
  transaction.baseSegment = transaction.trace.root.add('basesegment')
  transaction.nameState.setPrefix('Restify')
  transaction.nameState.setVerb('COOL')
  transaction.nameState.setDelimiter('/')
  transaction.nameState.appendPath('/foo/:foo', { foo: 'biz' })
  transaction.nameState.appendPath('/bar/:bar', { bar: 'bang' })
}

function setupHighSecurity(agent) {
  agent.config.high_security = true
  agent.config._applyHighSecurity()
  agent.config.emit('attributes.include')
}

function getMetrics(agent) {
  return agent.metrics._metrics
}

function createHeadersAndInsertTrace(transaction) {
  const headers = {}
  transaction.insertDistributedTraceHeaders(headers)

  return headers
}

function addSegmentInContext(contextManager, transaction, name) {
  const segment = new Segment(transaction, name)
  contextManager.setContext(segment)

  return segment
}
