/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../lib/agent_helper')
const API = require('../../api')
const AttributeFilter = require('../../lib/config/attribute-filter')
const Metrics = require('../../lib/metrics')
const Trace = require('../../lib/transaction/trace')
const Transaction = require('../../lib/transaction')
const Segment = require('../../lib/transaction/trace/segment')
const hashes = require('../../lib/util/hashes')
const sinon = require('sinon')

tap.test('Transaction unit tests', (t) => {
  t.autoend()

  let agent = null
  let txn = null

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
    txn = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('basic transaction tests', (t) => {
    t.throws(
      () => {
        return new Transaction()
      },
      /must be bound to the agent/,
      'should require an agent to create new transactions'
    )

    const trace = txn.trace
    t.ok(trace instanceof Trace, 'should create a trace on demand')
    t.notOk(trace instanceof Array, 'should have at most one associated trace')

    agent.on('transactionFinished', (inner) => {
      t.equal(
        inner.metrics,
        txn.metrics,
        'should hand its metrics off to the agent upon finalization'
      )
      t.end()
    })

    txn.end()
  })

  t.test('with DT enabled, should produce span events when finalizing', (t) => {
    agent.config.distributed_tracing.enabled = true

    agent.once('transactionFinished', () => {
      t.equal(agent.spanEventAggregator.length, 1, 'should have a span event')
    })
    helper.runInTransaction(agent, function (inner) {
      const childSegment = inner.trace.add('child')
      childSegment.start()
      inner.end()
    })

    t.end()
  })

  t.test('with DT enabled, should not produce span events when ignored', (t) => {
    agent.config.distributed_tracing.enabled = true

    agent.once('transactionFinished', () => {
      t.equal(agent.spanEventAggregator.length, 0, 'should have no span events')
    })
    helper.runInTransaction(agent, function (inner) {
      const childSegment = inner.trace.add('child')
      childSegment.start()
      inner.ignore = true
      inner.end()
    })

    t.end()
  })

  t.test('handing itself off to the agent upon finalization', (t) => {
    agent.on('transactionFinished', (inner) => {
      t.same(inner, txn, 'should have the same transaction')
      t.end()
    })

    txn.end()
  })

  t.test('should flush logs on end', (t) => {
    sinon.spy(txn.logs, 'flush')
    agent.on('transactionFinished', (inner) => {
      t.equal(inner.logs.flush.callCount, 1, 'should call `flush` once')
      t.end()
    })

    txn.logs.add('log-line1')
    txn.logs.add('log-line2')
    txn.end()
  })

  t.test('should not flush logs when transaction is ignored', (t) => {
    sinon.spy(txn.logs, 'flush')
    agent.on('transactionFinished', (inner) => {
      t.equal(inner.logs.flush.callCount, 0, 'should not call `flush`')
      t.end()
    })

    txn.logs.add('log-line1')
    txn.logs.add('log-line2')
    txn.ignore = true
    txn.end()
  })

  t.test('initial transaction attributes', (t) => {
    t.ok(txn.id, 'should have an ID')
    t.ok(txn.metrics, 'should have associated metrics')
    t.ok(txn.timer.isActive(), 'should be timing its duration')
    t.equal(txn.url, null, 'should have no associated URL (for hidden class)')
    t.equal(txn.name, null, 'should have no name set (for hidden class)')
    t.equal(txn.nameState.getName(), null, 'should have no PARTIAL name set (for hidden class)')
    t.equal(txn.statusCode, null, 'should have no HTTP status code set (for hidden class)')
    t.equal(txn.error, null, 'should have no error attached (for hidden class)')
    t.equal(txn.verb, null, 'should have no HTTP method / verb set (for hidden class)')
    t.notOk(txn.ignore, 'should not be ignored by default (for hidden class)')
    t.equal(txn.sampled, null, 'should not have a sampled state set')
    t.end()
  })

  t.test('with associated metrics', (t) => {
    t.ok(txn.metrics instanceof Metrics, 'should have metrics')
    t.not(txn.metrics, getMetrics(agent), 'should manage its own independent of the agent')
    t.equal(
      getMetrics(agent).apdexT,
      txn.metrics.apdexT,
      'should have the same apdex threshold as the agent'
    )
    t.equal(agent.mapper, txn.metrics.mapper, 'should have the same metrics mapper as the agent')
    t.end()
  })

  t.test('web transactions', (t) => {
    txn.type = Transaction.TYPES.BG
    t.notOk(txn.isWeb(), 'should know when it is not a web transaction')
    txn.type = Transaction.TYPES.WEB
    t.ok(txn.isWeb(), 'should know when it is a web transaction')
    t.end()
  })

  t.test('when dealing with individual metrics', (t) => {
    let tt = new Transaction(agent)
    tt.measure('Custom/Test01')
    t.ok(tt.metrics.getMetric('Custom/Test01'), 'should add metrics by name')

    tt.end()

    const TRACE_NAME = 'Custom/Test06'
    const SLEEP_DURATION = 43
    tt = new Transaction(agent)

    tt.measure(TRACE_NAME, null, SLEEP_DURATION)
    tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5)

    const statistics = tt.metrics.getMetric(TRACE_NAME)
    t.equal(
      statistics.callCount,
      2,
      'should allow multiple overlapping metric measurements for same name'
    )
    t.ok(statistics.max > (SLEEP_DURATION - 1) / 1000, 'should measure at least 42 milliseconds')

    tt.end()

    tt = new Transaction(agent)
    tt.measure('Custom/Test16', null, 65)
    tt.end()

    const metrics = tt.metrics.getMetric('Custom/Test16')
    t.equal(metrics.total, 0.065, 'should allow manual setting of metric durations')

    t.end()
  })

  t.test('when setting apdex for key transactions', (t) => {
    txn._setApdex('Apdex/TestController/key', 1200, 667)
    const metric = txn.metrics.getMetric('Apdex/TestController/key')

    t.equal(metric.apdexT, 0.667, 'should set apdexT to the key transaction apdexT')
    t.equal(metric.satisfying, 0, 'should not have satisfied')
    t.equal(metric.tolerating, 1, 'should have been tolerated')
    t.equal(metric.frustrating, 0, 'should not have frustrated')

    txn._setApdex('Apdex/TestController/another', 1200)
    const another = txn.metrics.getMetric('Apdex/TestController/another')
    t.equal(another.apdexT, 0.1, 'should not require a key transaction apdexT')
    t.end()
  })

  t.test('should ignore calculating apdex when ignoreApdex is true', (t) => {
    txn.ignoreApdex = true
    txn._setApdex('Apdex/TestController/key', 1200, 667)
    const metric = txn.metrics.getMetric('Apdex/TestController/key')
    t.notOk(metric)
    t.end()
  })
})

tap.test('Transaction naming tests', (t) => {
  t.autoend()
  let agent = null
  let txn = null
  function beforeEach() {
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })
    agent.config.emit('attributes.include')
    txn = new Transaction(agent)
  }

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('getName', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)

    t.test('base test', (t) => {
      t.equal(txn.getName(), null, 'should return `null` if there is no name, partialName, or url')
      t.end()
    })

    t.test('partial name should remain unset if it was not set before', (t) => {
      txn.url = '/some/pathname'
      t.equal(txn.nameState.getName(), null, 'should have no namestate')
      t.equal(txn.getName(), 'NormalizedUri/*', 'should have a default partial name')
      t.equal(txn.nameState.getName(), null, 'should still have no namestate')
      t.end()
    })

    t.test('should return the right name if partialName and url are set', (t) => {
      txn.nameState.setPrefix('Framework')
      txn.nameState.setVerb('verb')
      txn.nameState.appendPath('route')
      txn.url = '/route'
      t.equal(txn.getName(), 'WebFrameworkUri/Framework/VERB/route', 'should have full name')
      t.equal(txn.nameState.getName(), 'Framework/VERB/route', 'should have the partial name')
      t.end()
    })

    t.test('should return the name if it has already been set', (t) => {
      txn.setPartialName('foo/bar')
      t.equal(txn.getName(), 'foo/bar', 'name should be as set')
      t.end()
    })
  })

  t.test('isIgnored', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)

    t.test('should return true if a transaction is ignored by a rule', (t) => {
      const api = new API(agent)
      api.addIgnoringRule('^/test/')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.ok(txn.isIgnored(), 'should ignore the transaction')
      t.end()
    })
  })

  t.test('getFullName', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)

    t.test('should return null if it does not have name, partialName, or url', (t) => {
      t.equal(txn.getFullName(), null, 'should not have a full name')
      t.end()
    })

    t.test('partial name should remain unset if it was not set before', (t) => {
      txn.url = '/some/pathname'
      t.equal(txn.nameState.getName(), null, 'should have no namestate')
      t.equal(
        txn.getFullName(),
        'WebTransaction/NormalizedUri/*',
        'should have a default full name'
      )
      t.equal(txn.nameState.getName(), null, 'should still have no namestate')
      t.end()
    })

    t.test('should return the right name if partialName and url are set', (t) => {
      txn.nameState.setPrefix('Framework')
      txn.nameState.setVerb('verb')
      txn.nameState.appendPath('route')
      txn.url = '/route'
      t.equal(
        txn.getFullName(),
        'WebTransaction/WebFrameworkUri/Framework/VERB/route',
        'should have full name'
      )
      t.equal(txn.nameState.getName(), 'Framework/VERB/route', 'should have full name')
      t.end()
    })

    t.test('should return the name if it has already been set', (t) => {
      txn.name = 'OtherTransaction/foo/bar'
      t.equal(txn.getFullName(), 'OtherTransaction/foo/bar')
      t.end()
    })

    t.test('should return the forced name if set', (t) => {
      txn.name = 'FullName'
      txn._partialName = 'PartialName'
      txn.forceName = 'ForcedName'
      t.equal(txn.getFullName(), 'WebTransaction/ForcedName')
      t.end()
    })
  })

  t.test('with no partial name set', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)

    t.test('produces a normalized (backstopped) name when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('produces a normalized partial name when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn._partialName, 'NormalizedUri/*')
      t.end()
    })

    t.test('passes through status code when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.statusCode, 200)
      t.end()
    })

    t.test('produces a non-error name when status code is ignored', (t) => {
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
      t.equal(txn.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('produces a non-error partial name when status code is ignored', (t) => {
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
      t.equal(txn._partialName, 'NormalizedUri/*')
      t.end()
    })

    t.test('passes through status code when status is 404', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
      t.equal(txn.statusCode, 404)
      t.end()
    })

    t.test('produces a `not found` partial name when status is 404', (t) => {
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
      t.equal(txn._partialName, 'Expressjs/GET/(not found)')
      t.end()
    })

    t.test('produces a `not found` name when status is 404', (t) => {
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
      t.equal(txn.name, 'WebTransaction/Expressjs/GET/(not found)')
      t.end()
    })

    t.test('passes through status code when status is 405', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
      t.equal(txn.statusCode, 405)
      t.end()
    })

    t.test('produces a `method not allowed` partial name when status is 405', (t) => {
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
      t.equal(txn._partialName, 'Expressjs/GET/(method not allowed)')
      t.end()
    })

    t.test('produces a `method not allowed` name when status is 405', (t) => {
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 405)
      t.equal(txn.name, 'WebTransaction/Expressjs/GET/(method not allowed)')
      t.end()
    })

    t.test('produces a name based on 501 status code message', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn.name, 'WebTransaction/WebFrameworkUri/(not implemented)')
      t.end()
    })

    t.test('produces a regular partial name based on 501 status code message', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn._partialName, 'WebFrameworkUri/(not implemented)')
      t.end()
    })

    t.test('passes through status code when status is 501', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn.statusCode, 501)
      t.end()
    })

    t.test('should update value from segment normalizer rules', (t) => {
      const url = 'NormalizedUri/test/explicit/string/lyrics'
      txn.forceName = url
      txn.url = url
      agent.txSegmentNormalizer.load([
        { prefix: 'WebTransaction/NormalizedUri', terms: ['test', 'string'] }
      ])
      txn.finalizeNameFromUri(url, 200)
      t.equal(txn.name, 'WebTransaction/NormalizedUri/test/*/string/*')
      t.end()
    })

    t.test('should not scope web transactions to their URL', (t) => {
      txn.finalizeNameFromUri('/test/1337?action=edit', 200)
      t.not(txn.name, '/test/1337?action=edit')
      t.not(txn.name, 'WebTransaction/Uri/test/1337')
      t.end()
    })
  })

  t.test('with a custom partial name set', (t) => {
    t.autoend()

    t.beforeEach(() => {
      beforeEach()
      txn.nameState.setPrefix('Custom')
      txn.nameState.appendPath('test')
      agent.transactionNameNormalizer.rules = []
    })

    t.test('produces a custom name when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.name, 'WebTransaction/Custom/test')
      t.end()
    })

    t.test('produces a partial name when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.nameState.getName(), 'Custom/test')
      t.end()
    })

    t.test('should rename a transaction when told to by a rule', (t) => {
      agent.transactionNameNormalizer.addSimple('^(WebTransaction/Custom)/test$', '$1/*')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.name, 'WebTransaction/Custom/*')
      t.end()
    })

    t.test('passes through status code when status is 200', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.equal(txn.statusCode, 200)
      t.end()
    })

    t.test('keeps the custom name when error status is ignored', (t) => {
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 500)
      t.equal(txn.name, 'WebTransaction/Custom/test')
      t.end()
    })

    t.test('keeps the custom partial name when error status is ignored', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
      t.equal(txn.nameState.getName(), 'Custom/test')
      t.end()
    })

    t.test('passes through status code when status is 404', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 404)
      t.equal(txn.statusCode, 404)
      t.end()
    })

    t.test('produces the custom name even when status is 501', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn.name, 'WebTransaction/Custom/test')
      t.end()
    })

    t.test('produces the custom partial name even when status is 501', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn.nameState.getName(), 'Custom/test')
      t.end()
    })

    t.test('passes through status code when status is 501', (t) => {
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 501)
      t.equal(txn.statusCode, 501)
      t.end()
    })

    t.test('should ignore a transaction when told to by a rule', (t) => {
      agent.transactionNameNormalizer.addSimple('^WebTransaction/Custom/test$')
      txn.finalizeNameFromUri('/test/string?do=thing&another=thing', 200)
      t.ok(txn.isIgnored())
      t.end()
    })
  })

  t.test('pathHashes', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)

    t.test('should add up to 10 items to to pathHashes', (t) => {
      const toAdd = ['1', '2', '3', '4', '4', '5', '6', '7', '8', '9', '10', '11']
      const expected = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

      toAdd.forEach(txn.pushPathHash.bind(txn))
      t.same(txn.pathHashes, expected)
      t.end()
    })

    t.test('should not include current pathHash in alternatePathHashes', (t) => {
      txn.name = '/a/b/c'
      txn.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        txn.name,
        txn.referringPathHash
      )

      txn.pathHashes = ['/a', curHash, '/a/b']
      t.equal(txn.alternatePathHashes(), '/a,/a/b')
      txn.nameState.setPrefix(txn.name)
      txn.name = null
      txn.pathHashes = ['/a', '/a/b']
      t.equal(txn.alternatePathHashes(), '/a,/a/b')
      t.end()
    })

    t.test('should return null when no alternate pathHashes exist', (t) => {
      txn.nameState.setPrefix('/a/b/c')
      txn.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        txn.nameState.getName(),
        txn.referringPathHash
      )

      txn.pathHashes = [curHash]
      t.equal(txn.alternatePathHashes(), null)
      txn.pathHashes = []
      t.equal(txn.alternatePathHashes(), null)
      t.end()
    })
  })
})

tap.test('Transaction methods', (t) => {
  t.autoend()
  let txn = null
  let agent = null

  function bookends(t) {
    t.beforeEach(() => {
      agent = helper.loadMockedAgent()
      txn = new Transaction(agent)
    })

    t.afterEach(() => {
      helper.unloadAgent(agent)
    })
  }

  t.test('hasErrors', (t) => {
    t.autoend()
    bookends(t)

    t.test('should return true if exceptions property is not empty', (t) => {
      t.notOk(txn.hasErrors())
      txn.exceptions.push(new Error())
      t.ok(txn.hasErrors())
      t.end()
    })

    t.test('should return true if statusCode is an error', (t) => {
      txn.statusCode = 500
      t.ok(txn.hasErrors())
      t.end()
    })
  })

  t.test('isSampled', (t) => {
    t.autoend()
    bookends(t)

    t.test('should be true when the transaction is sampled', (t) => {
      // the first 10 transactions are sampled so this should be true
      t.ok(txn.isSampled())
      t.end()
    })

    t.test('should be false when the transaction is not sampled', (t) => {
      txn.priority = Infinity
      txn.sampled = false
      t.notOk(txn.isSampled())
      t.end()
    })
  })

  t.test('getIntrinsicAttributes', (t) => {
    t.autoend()
    bookends(t)

    t.test('includes CAT attributes when enabled', (t) => {
      txn.agent.config.cross_application_tracer.enabled = true
      txn.agent.config.distributed_tracing.enabled = false
      txn.tripId = '3456'
      txn.referringTransactionGuid = '1234'
      txn.incomingCatId = '2345'

      const attributes = txn.getIntrinsicAttributes()
      t.equal(attributes.referring_transaction_guid, '1234')
      t.equal(attributes.client_cross_process_id, '2345')
      t.type(attributes.path_hash, 'string')
      t.equal(attributes.trip_id, '3456')
      t.end()
    })

    t.test('includes Synthetics attributes', (t) => {
      txn.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      const attributes = txn.getIntrinsicAttributes()
      t.equal(attributes.synthetics_resource_id, 'resId')
      t.equal(attributes.synthetics_job_id, 'jobId')
      t.equal(attributes.synthetics_monitor_id, 'monId')
      t.end()
    })

    t.test('includes Synthetics Info attributes', (t) => {
      // spec states must be present too
      txn.syntheticsData = {}
      txn.syntheticsInfoData = {
        version: 1,
        type: 'unitTest',
        initiator: 'cli',
        attributes: {
          'Attr-Test': 'value',
          'attr2Test': 'value1',
          'xTest-Header': 'value2'
        }
      }

      const attributes = txn.getIntrinsicAttributes()
      t.equal(attributes.synthetics_type, 'unitTest')
      t.equal(attributes.synthetics_initiator, 'cli')
      t.equal(attributes.synthetics_attr_test, 'value')
      t.equal(attributes.synthetics_attr_2_test, 'value1')
      t.equal(attributes.synthetics_x_test_header, 'value2')
      t.end()
    })

    t.test('returns different object every time', (t) => {
      t.not(txn.getIntrinsicAttributes(), txn.getIntrinsicAttributes())
      t.end()
    })

    t.test('includes distributed trace attributes', (t) => {
      const attributes = txn.getIntrinsicAttributes()
      t.ok(txn.priority.toString().length <= 8)

      t.has(attributes, {
        guid: txn.id,
        traceId: txn.traceId,
        priority: txn.priority,
        sampled: true
      })
      t.end()
    })
  })

  t.test('getResponseDurationInMillis', (t) => {
    t.autoend()
    bookends(t)

    t.test('for web transactions', (t) => {
      txn.url = 'someUrl'

      // add a segment that will end after the txn ends
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.end()
      childSegment.end()

      // response time should equal the transaction timer duration
      t.equal(
        txn.getResponseTimeInMillis(),
        txn.timer.getDurationInMillis(),
        'should use the time until transaction.end() is called'
      )
      t.end()
    })

    t.test('for background transactions', (t) => {
      // add a segment that will end after the transaction ends
      txn.type = Transaction.TYPES.BG
      const bgTransactionSegment = txn.trace.add('backgroundWork')
      bgTransactionSegment.start()

      txn.end()
      bgTransactionSegment.end()

      // response time should equal the full duration of the trace
      t.equal(
        txn.getResponseTimeInMillis(),
        txn.trace.getDurationInMillis(),
        'should report response time equal to trace duration'
      )
      t.end()
    })
  })
})

tap.test('_acceptDistributedTracePayload', (t) => {
  t.autoend()
  let txn = null
  let agent = null

  t.beforeEach(function () {
    agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })
    agent.config.trusted_account_key = '1'
    // Clear deprecated values just to be extra sure.
    agent.config._process_id = null
    agent.config.account_ids = null

    agent.recordSupportability = sinon.spy()

    txn = new Transaction(agent)
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('records supportability metric if no payload was passed', (t) => {
    txn._acceptDistributedTracePayload(null)
    t.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/Null'
    )
    t.end()
  })

  t.test(
    'when already marked as distributed trace, records `Multiple` supportability metric if parentId exists',
    (t) => {
      txn.isDistributedTrace = true
      txn.parentId = 'exists'

      txn._acceptDistributedTracePayload({})
      t.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/Multiple'
      )
      t.end()
    }
  )

  t.test(
    'when already marked as distributed trace, records `CreateBeforeAccept` metric if parentId does not exist',
    (t) => {
      txn.isDistributedTrace = true

      txn._acceptDistributedTracePayload({})
      t.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
      )
      t.end()
    }
  )

  t.test('should not accept payload if no configured trusted key', (t) => {
    txn.agent.config.trusted_account_key = null
    txn.agent.config.account_id = null

    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() - 1
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })

    t.equal(txn.agent.recordSupportability.args[0][0], 'DistributedTrace/AcceptPayload/Exception')
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('should not accept payload if DT disabled', (t) => {
    txn.agent.config.distributed_tracing.enabled = false

    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() - 1
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })

    t.equal(txn.agent.recordSupportability.args[0][0], 'DistributedTrace/AcceptPayload/Exception')
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('should accept payload if config valid and CAT disabled', (t) => {
    txn.agent.config.cross_application_tracer.enabled = false

    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() - 1
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })

    t.ok(txn.isDistributedTrace)
    t.end()
  })

  t.test('fails if payload version is above agent-supported version', (t) => {
    txn._acceptDistributedTracePayload({ v: [1, 0] })
    t.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('fails if payload account id is not in trusted ids', (t) => {
    const data = {
      ac: 2,
      ty: 'App',
      id: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now()
    }

    txn._acceptDistributedTracePayload({
      v: [0, 1],
      d: data
    })
    t.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/UntrustedAccount'
    )
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('fails if payload data is missing required keys', (t) => {
    txn._acceptDistributedTracePayload({
      v: [0, 1],
      d: {
        ac: 1
      }
    })
    t.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('takes the priority and sampled state from the incoming payload', (t) => {
    const data = {
      ac: '1',
      ty: 'App',
      id: txn.id,
      tr: txn.id,
      ap: 'test',
      pr: 1.9999999,
      sa: true,
      ti: Date.now()
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })
    t.ok(txn.sampled)
    t.equal(txn.priority, data.pr)
    // Should not truncate accepted priority
    t.equal(txn.priority.toString().length, 9)
    t.end()
  })

  t.test('does not take the distributed tracing data if priority is missing', (t) => {
    const data = {
      ac: 1,
      ty: 'App',
      id: txn.id,
      tr: txn.id,
      ap: 'test',
      sa: true,
      ti: Date.now()
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })
    t.equal(txn.priority, null)
    t.equal(txn.sampled, null)
    t.end()
  })

  t.test('stores payload props on transaction', (t) => {
    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() - 1
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })
    t.equal(txn.agent.recordSupportability.args[0][0], 'DistributedTrace/AcceptPayload/Success')
    t.equal(txn.parentId, data.tx)
    t.equal(txn.parentType, data.ty)
    t.equal(txn.traceId, data.tr)
    t.ok(txn.isDistributedTrace)
    t.ok(txn.parentTransportDuration > 0)
    t.end()
  })

  t.test('should 0 transport duration when receiving payloads from the future', (t) => {
    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      id: txn.trace.root.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() + 1000
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })
    t.equal(txn.agent.recordSupportability.args[0][0], 'DistributedTrace/AcceptPayload/Success')
    t.equal(txn.parentId, data.tx)
    t.equal(txn.parentSpanId, txn.trace.root.id)
    t.equal(txn.parentType, data.ty)
    t.equal(txn.traceId, data.tr)
    t.ok(txn.isDistributedTrace)
    t.equal(txn.parentTransportDuration, 0)
    t.end()
  })
  t.end()
})

tap.test('_getParsedPayload', (t) => {
  t.autoend()

  let txn = null
  let agent = null
  let payload = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })

    agent.recordSupportability = sinon.spy()
    txn = new Transaction(agent)
    payload = JSON.stringify({
      test: 'payload'
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('returns parsed JSON object', (t) => {
    const res = txn._getParsedPayload(payload)
    t.same(res, { test: 'payload' })
    t.end()
  })

  t.test('returns parsed object from base64 string', (t) => {
    txn.agent.config.encoding_key = 'test'

    const res = txn._getParsedPayload(payload.toString('base64'))
    t.same(res, { test: 'payload' })
    t.end()
  })

  t.test('returns null if string is invalid JSON', (t) => {
    const res = txn._getParsedPayload('{invalid JSON string}')
    t.equal(res, null)
    t.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    t.end()
  })

  t.test('returns null if decoding fails', (t) => {
    txn.agent.config.encoding_key = 'test'
    payload = hashes.obfuscateNameUsingKey(payload, 'some other key')

    const res = txn._getParsedPayload(payload)
    t.equal(res, null)
    t.end()
  })
})

tap.test('_createDistributedTracePayload', (t) => {
  t.autoend()

  let txn = null
  let agent = null
  let contextManager = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })

    agent.recordSupportability = sinon.spy()
    agent.config.account_id = '5678'
    agent.config.primary_application_id = '1234'
    agent.config.trusted_account_key = '5678'

    // Clear deprecated values just to be extra sure.
    agent.config.cross_process_id = null
    agent.config.trusted_account_ids = null

    contextManager = helper.getContextManager()
    txn = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should not create payload when DT disabled', (t) => {
    txn.agent.config.distributed_tracing.enabled = false

    const payload = txn._createDistributedTracePayload().text()
    t.equal(payload, '')
    t.equal(txn.agent.recordSupportability.callCount, 0)
    t.notOk(txn.isDistributedTrace)
    t.end()
  })

  t.test('should create payload when DT enabled and CAT disabled', (t) => {
    txn.agent.config.cross_application_tracer.enabled = false

    const payload = txn._createDistributedTracePayload().text()

    t.not(payload, null)
    t.not(payload, '')
    t.end()
  })

  t.test('does not change existing priority', (t) => {
    txn.priority = 999
    txn.sampled = false

    txn._createDistributedTracePayload()

    t.equal(txn.priority, 999)
    t.notOk(txn.sampled)
    t.end()
  })

  t.test('sets the transaction as sampled if the trace is chosen', (t) => {
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    t.equal(payload.d.sa, txn.sampled)
    t.equal(payload.d.pr, txn.priority)
    t.end()
  })

  t.test('adds the current span id as the parent span id', (t) => {
    agent.config.span_events.enabled = true
    contextManager.setContext(txn.trace.root)
    txn.sampled = true
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    t.equal(payload.d.id, txn.trace.root.id)
    contextManager.setContext(null)
    agent.config.span_events.enabled = false
    t.end()
  })

  t.test('does not add the span id if the transaction is not sampled', (t) => {
    agent.config.span_events.enabled = true
    txn._calculatePriority()
    txn.sampled = false
    contextManager.setContext(txn.trace.root)
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    t.equal(payload.d.id, undefined)
    contextManager.setContext(null)
    agent.config.span_events.enabled = false
    t.end()
  })

  t.test('returns stringified payload object', (t) => {
    const payload = txn._createDistributedTracePayload().text()
    t.type(payload, 'string')
    t.equal(txn.agent.recordSupportability.args[0][0], 'DistributedTrace/CreatePayload/Success')
    t.ok(txn.isDistributedTrace)
    t.end()
  })
})

tap.test('acceptDistributedTraceHeaders', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true },
      span_events: { enabled: true }
    })
    agent.config.trusted_account_key = '1'
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should accept a valid trace context traceparent header', (t) => {
    const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    const headers = {
      traceparent: goodParent
    }

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.acceptDistributedTraceHeaders('HTTP', headers)

      t.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      t.equal(txn.parentSpanId, '00f067aa0ba902b7')

      txn.end()
      t.end()
    })
  })

  t.test('should not accept invalid trace context traceparent header', (t) => {
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

      t.equal(secondHeaders.traceparent, origTraceparent)
      txn.end()
      t.end()
    })
  })

  t.test('should use newrelic format when no traceparent', (t) => {
    const trustedAccountKey = '123'
    agent.config.trusted_account_key = trustedAccountKey

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

      t.ok(txn.isDistributedTrace)
      t.ok(txn.acceptedDistributedTrace)

      const outboundHeaders = createHeadersAndInsertTrace(txn)
      const splitData = outboundHeaders.traceparent.split('-')
      const [, traceId] = splitData

      t.equal(traceId, expectedTraceId)
      txn.end()
      t.end()
    })
  })

  t.test('should not throw error when headers is a string', (t) => {
    const trustedAccountKey = '123'
    agent.config.trusted_account_key = trustedAccountKey

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      const headers = 'JUST A STRING'

      t.doesNotThrow(function () {
        txn.acceptDistributedTraceHeaders('HTTP', headers)
      })

      t.equal(txn.isDistributedTrace, null)
      t.equal(txn.acceptedDistributedTrace, null)

      txn.end()
      t.end()
    })
  })

  t.test('should only accept the first tracecontext', (t) => {
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

      t.equal(txn.traceId, expectedTraceId)
      t.equal(txn.parentSpanId, expectedParentSpanId)
      t.equal(txn.parentApp, '2827902')

      txn.end()
      t.end()
    })
  })

  t.test('should not accept tracecontext after sending a trace', (t) => {
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

      t.not(txn.traceId, unexpectedTraceId)
      t.not(txn.parentSpanId, unexpectedParentSpanId)
      t.not(txn.parentApp, '2827902')

      const traceparentParts = outboundHeaders.traceparent.split('-')
      const [, expectedTraceId] = traceparentParts

      t.equal(txn.traceId, expectedTraceId)

      txn.end()
      t.end()
    })
  })
})

tap.test('insertDistributedTraceHeaders', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
    contextManager = helper.getContextManager()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test(
    'should lowercase traceId for tracecontext when recieved upper from newrelic format',
    (t) => {
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

        t.ok(txn.isDistributedTrace)
        t.ok(txn.acceptedDistributedTrace)

        const insertedHeaders = {}
        txn.insertDistributedTraceHeaders(insertedHeaders)

        const splitData = insertedHeaders.traceparent.split('-')
        const [, traceId] = splitData

        t.equal(traceId, expectedTraceContextTraceId)

        const rawPayload = Buffer.from(insertedHeaders.newrelic, 'base64').toString('utf-8')
        const payload = JSON.parse(rawPayload)

        // newrelic header should have traceId untouched
        t.equal(payload.d.tr, incomingTraceId)

        // traceId used for metrics shoudl go untouched
        t.equal(txn.traceId, incomingTraceId)

        txn.end()
        t.end()
      })
    }
  )

  t.test('should generate a valid new trace context traceparent header', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)

    contextManager.setContext(txn.trace.root)

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    const lowercaseHexRegex = /^[a-f0-9]+/

    t.equal(traceparentParts.length, 4)
    t.equal(traceparentParts[0], '00', 'version matches')
    t.equal(traceparentParts[1].length, 32, 'traceId of length 32')
    t.equal(traceparentParts[2].length, 16, 'parentId of length 16')
    t.equal(traceparentParts[3], '01', 'flags match')

    t.match(traceparentParts[1], lowercaseHexRegex, 'traceId is lowercase hex')
    t.match(traceparentParts[2], lowercaseHexRegex, 'parentId is lowercase hex')

    t.end()
  })

  t.test('should generate new parentId when spans_events disabled', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = false

    const txn = new Transaction(agent)
    const lowercaseHexRegex = /^[a-f0-9]+/

    contextManager.setContext(txn.trace.root)

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    t.equal(traceparentParts[2].length, 16, 'parentId has length 16')

    t.match(traceparentParts[2], lowercaseHexRegex, 'parentId is lowercase hex')
    t.end()
  })

  t.test('should set traceparent sample part to 01 for sampled transaction', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)

    contextManager.setContext(txn.trace.root)
    txn.sampled = true

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    t.equal(traceparentParts[3], '01', 'flags match')

    t.end()
  })

  t.test('should set traceparent traceid if traceparent exists on transaction', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
    const tracestate = '323322332234234234423'

    txn.acceptTraceContextPayload(traceparent, tracestate)

    contextManager.setContext(txn.trace.root)

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparentParts = outboundHeaders.traceparent.split('-')

    t.equal(traceparentParts[1], '4bf92f3577b34da6a3ce929d0e0e4736', 'traceId matches')

    t.end()
  })

  t.test('generates a priority for entry-point transactions', (t) => {
    const txn = new Transaction(agent)

    t.equal(txn.priority, null)
    t.equal(txn.sampled, null)

    txn.insertDistributedTraceHeaders({})

    t.type(txn.priority, 'number')
    t.type(txn.sampled, 'boolean')
    t.end()
  })
})

tap.test('acceptTraceContextPayload', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should accept a valid trace context traceparent header', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.acceptTraceContextPayload(goodParent, 'stuff')

      t.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      t.equal(txn.parentSpanId, '00f067aa0ba902b7')

      txn.end()
      t.end()
    })
  })

  t.test('should not accept invalid trace context traceparent header', (t) => {
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

      t.equal(secondHeaders.traceparent, origTraceparent)
      txn.end()
      t.end()
    })
  })

  t.test('should not accept tracestate when trusted_account_key missing', (t) => {
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
      t.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      t.equal(txn.parentSpanId, '00f067aa0ba902b7')

      // tracestate
      t.equal(txn.parentType, null)
      t.equal(txn.accountId, undefined)
      t.equal(txn.parentApp, null)
      t.equal(txn.parentId, null)

      txn.end()
      t.end()
    })
  })

  t.test('should accept tracestate when trusted_account_key matches', (t) => {
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
      t.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      t.equal(txn.parentSpanId, '00f067aa0ba902b7')

      // tracestate
      t.equal(txn.parentType, 'App')
      t.equal(txn.parentAcct, '33')
      t.equal(txn.parentApp, '2827902')
      t.equal(txn.parentId, 'e8b91a159289ff74')

      txn.end()
      t.end()
    })
  })
})

tap.test('addDistributedTraceIntrinsics', (t) => {
  t.autoend()

  let txn = null
  let attributes = null
  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })
    attributes = {}
    txn = new Transaction(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('does not change existing priority', (t) => {
    txn.priority = 999
    txn.sampled = false

    txn.addDistributedTraceIntrinsics(attributes)

    t.equal(txn.priority, 999)
    t.notOk(txn.sampled)
    t.end()
  })

  t.test('adds expected attributes if no payload was received', (t) => {
    txn.isDistributedTrace = false

    txn.addDistributedTraceIntrinsics(attributes)

    const expected = {
      guid: txn.id,
      traceId: txn.traceId,
      priority: txn.priority,
      sampled: true
    }
    t.has(attributes, expected)
    t.end()
  })

  t.test('adds DT attributes if payload was accepted', (t) => {
    txn.agent.config.account_id = '5678'
    txn.agent.config.primary_application_id = '1234'
    txn.agent.config.trusted_account_key = '5678'
    txn.agent.config.distributed_tracing.enabled = true

    const payload = txn._createDistributedTracePayload().text()
    txn.isDistributedTrace = false
    txn._acceptDistributedTracePayload(payload, 'AMQP')

    txn.addDistributedTraceIntrinsics(attributes)

    const expected = {
      'parent.type': 'App',
      'parent.app': '1234',
      'parent.account': '5678',
      'parent.transportType': 'AMQP'
    }
    t.has(attributes, expected)
    t.hasProp(attributes, 'parent.transportDuration')
    t.end()
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
      t.same(attrs, {})

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

  t.test('should call finalizeNameFromUri if no name is given for a web txn', (t) => {
    let called = false

    transaction.finalizeNameFromUri = () => {
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
  transaction.nameState.appendPath('/foo/:foo', { 'request.parameters.foo': 'biz' })
  transaction.nameState.appendPath('/bar/:bar', { 'request.parameters.bar': 'bang' })
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
