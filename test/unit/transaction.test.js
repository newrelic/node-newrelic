/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const API = require('../../api')
const AttributeFilter = require('#agentlib/config/attribute-filter.js')
const Metrics = require('#agentlib/metrics/index.js')
const Trace = require('#agentlib/transaction/trace/index.js')
const Transaction = require('#agentlib/transaction/index.js')
const Segment = require('#agentlib/transaction/trace/segment.js')
const hashes = require('#agentlib/util/hashes.js')
const sinon = require('sinon')

test('Transaction unit tests', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('basic transaction tests', (t, end) => {
    const { agent, txn } = t.nr
    assert.throws(
      () => new Transaction(),
      /must be bound to the agent/,
      'should require an agent to create new transactions'
    )

    const trace = txn.trace
    assert.ok(trace instanceof Trace, 'should create a trace on demand')
    assert.ok(!(trace instanceof Array), 'should have at most one associated trace')

    agent.on('transactionFinished', (inner) => {
      assert.equal(
        inner.metrics,
        txn.metrics,
        'should hand its metrics off to the agent upon finalization'
      )
      end()
    })

    txn.end()
  })

  await t.test('with DT enabled, should produce span events when finalizing', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true

    agent.once('transactionFinished', () => {
      assert.equal(agent.spanEventAggregator.length, 1, 'should have a span event')
    })
    helper.runInTransaction(agent, function (inner) {
      const childSegment = inner.trace.add('child')
      childSegment.start()
      inner.end()
    })

    end()
  })

  await t.test('with DT enabled, should not produce span events when ignored', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true

    agent.once('transactionFinished', () => {
      assert.equal(agent.spanEventAggregator.length, 0, 'should have no span events')
    })
    helper.runInTransaction(agent, function (inner) {
      const childSegment = inner.trace.add('child')
      childSegment.start()
      inner.ignore = true
      inner.end()
    })

    end()
  })

  await t.test('handing itself off to the agent upon finalization', (t, end) => {
    const { agent, txn } = t.nr
    agent.on('transactionFinished', (inner) => {
      assert.deepEqual(inner, txn, 'should have the same transaction')
      end()
    })

    txn.end()
  })

  await t.test('should flush logs on end', (t, end) => {
    const { agent, txn } = t.nr
    sinon.spy(txn.logs, 'flush')
    agent.on('transactionFinished', (inner) => {
      assert.equal(inner.logs.flush.callCount, 1, 'should call `flush` once')
      end()
    })

    txn.logs.add('log-line1')
    txn.logs.add('log-line2')
    txn.end()
  })

  await t.test('should not flush logs when transaction is ignored', (t, end) => {
    const { agent, txn } = t.nr
    sinon.spy(txn.logs, 'flush')
    agent.on('transactionFinished', (inner) => {
      assert.equal(inner.logs.flush.callCount, 0, 'should not call `flush`')
      end()
    })

    txn.logs.add('log-line1')
    txn.logs.add('log-line2')
    txn.ignore = true
    txn.end()
  })

  await t.test('initial transaction attributes', (t) => {
    const { txn } = t.nr
    assert.ok(txn.id, 'should have an ID')
    assert.ok(txn.metrics, 'should have associated metrics')
    assert.ok(txn.timer.isActive(), 'should be timing its duration')
    assert.equal(txn.url, null, 'should have no associated URL (for hidden class)')
    assert.equal(txn.name, null, 'should have no name set (for hidden class)')
    assert.equal(
      txn.nameState.getName(),
      null,
      'should have no PARTIAL name set (for hidden class)'
    )
    assert.equal(txn.statusCode, null, 'should have no HTTP status code set (for hidden class)')
    assert.equal(txn.error, null, 'should have no error attached (for hidden class)')
    assert.equal(txn.verb, null, 'should have no HTTP method / verb set (for hidden class)')
    assert.ok(!txn.ignore, 'should not be ignored by default (for hidden class)')
    assert.equal(txn.sampled, null, 'should not have a sampled state set')
  })

  await t.test('with associated metrics', (t) => {
    const { agent, txn } = t.nr
    assert.ok(txn.metrics instanceof Metrics, 'should have metrics')
    assert.notEqual(
      txn.metrics,
      getMetrics(agent),
      'should manage its own independent of the agent'
    )
    assert.equal(
      getMetrics(agent).apdexT,
      txn.metrics.apdexT,
      'should have the same apdex threshold as the agent'
    )
    assert.equal(
      agent.mapper,
      txn.metrics.mapper,
      'should have the same metrics mapper as the agent'
    )
  })

  await t.test('web transactions', (t) => {
    const { txn } = t.nr
    txn.type = Transaction.TYPES.BG
    assert.ok(!txn.isWeb(), 'should know when it is not a web transaction')
    txn.type = Transaction.TYPES.WEB
    assert.ok(txn.isWeb(), 'should know when it is a web transaction')
  })

  await t.test('when dealing with individual metrics', (t, end) => {
    const { agent } = t.nr
    let tt = new Transaction(agent)
    tt.measure('Custom/Test01')
    assert.ok(tt.metrics.getMetric('Custom/Test01'), 'should add metrics by name')

    tt.end()

    const TRACE_NAME = 'Custom/Test06'
    const SLEEP_DURATION = 43
    tt = new Transaction(agent)

    tt.measure(TRACE_NAME, null, SLEEP_DURATION)
    tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5)

    const statistics = tt.metrics.getMetric(TRACE_NAME)
    assert.equal(
      statistics.callCount,
      2,
      'should allow multiple overlapping metric measurements for same name'
    )
    assert.ok(
      statistics.max > (SLEEP_DURATION - 1) / 1000,
      'should measure at least 42 milliseconds'
    )

    tt.end()

    tt = new Transaction(agent)
    tt.measure('Custom/Test16', null, 65)
    tt.end()

    const metrics = tt.metrics.getMetric('Custom/Test16')
    assert.equal(metrics.total, 0.065, 'should allow manual setting of metric durations')

    end()
  })

  await t.test('when setting apdex for key transactions', (t) => {
    const { txn } = t.nr
    txn._setApdex('Apdex/TestController/key', 1200, 667)
    const metric = txn.metrics.getMetric('Apdex/TestController/key')

    assert.equal(metric.apdexT, 0.667, 'should set apdexT to the key transaction apdexT')
    assert.equal(metric.satisfying, 0, 'should not have satisfied')
    assert.equal(metric.tolerating, 1, 'should have been tolerated')
    assert.equal(metric.frustrating, 0, 'should not have frustrated')

    txn._setApdex('Apdex/TestController/another', 1200)
    const another = txn.metrics.getMetric('Apdex/TestController/another')
    assert.equal(another.apdexT, 0.1, 'should not require a key transaction apdexT')
  })

  await t.test('should ignore calculating apdex when ignoreApdex is true', (t) => {
    const { txn } = t.nr
    txn.ignoreApdex = true
    txn._setApdex('Apdex/TestController/key', 1200, 667)
    const metric = txn.metrics.getMetric('Apdex/TestController/key')
    assert.ok(!metric)
  })

  await t.test('should use traceId if passed in when creating transaction', (t) => {
    const { agent } = t.nr
    const traceId = hashes.makeId()
    const tx = new Transaction(agent, traceId)
    assert.equal(tx.traceId, traceId)
  })
})

test('Transaction naming tests', async (t) => {
  function bookends(t) {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent({
        attributes: {
          enabled: true,
          include: ['request.parameters.*']
        }
      })
      ctx.nr.agent.config.emit('attributes.include')
      ctx.nr.txn = new Transaction(ctx.nr.agent)
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })
  }

  await t.test('getName', async (t) => {
    bookends(t)

    await t.test('base test', (t) => {
      const { txn } = t.nr
      assert.equal(
        txn.getName(),
        null,
        'should return `null` if there is no name, partialName, or url'
      )
    })

    await t.test('partial name should remain unset if it was not set before', (t) => {
      const { txn } = t.nr
      txn.url = '/some/pathname'
      assert.equal(txn.nameState.getName(), null, 'should have no namestate')
      assert.equal(txn.getName(), 'NormalizedUri/*', 'should have a default partial name')
      assert.equal(txn.nameState.getName(), null, 'should still have no namestate')
    })

    await t.test('should return the right name if partialName and url are set', (t) => {
      const { txn } = t.nr
      txn.nameState.setPrefix('Framework')
      txn.nameState.setVerb('verb')
      txn.nameState.appendPath('route')
      txn.url = '/route'
      assert.equal(txn.getName(), 'WebFrameworkUri/Framework/VERB/route', 'should have full name')
      assert.equal(txn.nameState.getName(), 'Framework/VERB/route', 'should have the partial name')
    })

    await t.test('should return the name if it has already been set', (t) => {
      const { txn } = t.nr
      txn.setPartialName('foo/bar')
      assert.equal(txn.getName(), 'foo/bar', 'name should be as set')
    })
  })

  await t.test('isIgnored', async (t) => {
    bookends(t)

    await t.test('should return true if a transaction is ignored by a rule', (t) => {
      const { agent, txn } = t.nr
      const api = new API(agent)
      api.addIgnoringRule('^/test/')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.ok(txn.isIgnored(), 'should ignore the transaction')
    })
  })

  await t.test('getFullName', async (t) => {
    bookends(t)

    await t.test('should return null if it does not have name, partialName, or url', (t) => {
      const { txn } = t.nr
      assert.equal(txn.getFullName(), null, 'should not have a full name')
    })

    await t.test('partial name should remain unset if it was not set before', (t) => {
      const { txn } = t.nr
      txn.url = '/some/pathname'
      assert.equal(txn.nameState.getName(), null, 'should have no namestate')
      assert.equal(
        txn.getFullName(),
        'WebTransaction/NormalizedUri/*',
        'should have a default full name'
      )
      assert.equal(txn.nameState.getName(), null, 'should still have no namestate')
    })

    await t.test('should return the right name if partialName and url are set', (t) => {
      const { txn } = t.nr
      txn.nameState.setPrefix('Framework')
      txn.nameState.setVerb('verb')
      txn.nameState.appendPath('route')
      txn.url = '/route'
      assert.equal(
        txn.getFullName(),
        'WebTransaction/WebFrameworkUri/Framework/VERB/route',
        'should have full name'
      )
      assert.equal(txn.nameState.getName(), 'Framework/VERB/route', 'should have full name')
    })

    await t.test('should return the name if it has already been set', (t) => {
      const { txn } = t.nr
      txn.name = 'OtherTransaction/foo/bar'
      assert.equal(txn.getFullName(), 'OtherTransaction/foo/bar')
    })

    await t.test('should return the forced name if set', (t) => {
      const { txn } = t.nr
      txn.name = 'FullName'
      txn._partialName = 'PartialName'
      txn.forceName = 'ForcedName'
      assert.equal(txn.getFullName(), 'WebTransaction/ForcedName')
    })
  })

  await t.test('with no partial name set', async (t) => {
    bookends(t)

    await t.test('produces a normalized (backstopped) name when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.name, 'WebTransaction/NormalizedUri/*')
    })

    await t.test('produces a normalized partial name when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn._partialName, 'NormalizedUri/*')
    })

    await t.test('passes through status code when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.statusCode, 200)
    })

    await t.test('produces a non-error name when status code is ignored', (t) => {
      const { agent, txn } = t.nr
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(500)
      assert.equal(txn.name, 'WebTransaction/NormalizedUri/*')
    })

    await t.test('produces a non-error partial name when status code is ignored', (t) => {
      const { agent, txn } = t.nr
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(500)
      assert.equal(txn._partialName, 'NormalizedUri/*')
    })

    await t.test('passes through status code when status is 404', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(404)
      assert.equal(txn.statusCode, 404)
    })

    await t.test('produces a `not found` partial name when status is 404', (t) => {
      const { txn } = t.nr
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(404)
      assert.equal(txn._partialName, 'Expressjs/GET/(not found)')
    })

    await t.test('produces a `not found` name when status is 404', (t) => {
      const { txn } = t.nr
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(404)
      assert.equal(txn.name, 'WebTransaction/Expressjs/GET/(not found)')
    })

    await t.test('passes through status code when status is 405', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(405)
      assert.equal(txn.statusCode, 405)
    })

    await t.test('produces a `method not allowed` partial name when status is 405', (t) => {
      const { txn } = t.nr
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(405)
      assert.equal(txn._partialName, 'Expressjs/GET/(method not allowed)')
    })

    await t.test('produces a `method not allowed` name when status is 405', (t) => {
      const { txn } = t.nr
      txn.nameState.setName('Expressjs', 'GET', '/')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(405)
      assert.equal(txn.name, 'WebTransaction/Expressjs/GET/(method not allowed)')
    })

    await t.test('produces a name based on 501 status code message', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn.name, 'WebTransaction/WebFrameworkUri/(not implemented)')
    })

    await t.test('produces a regular partial name based on 501 status code message', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn._partialName, 'WebFrameworkUri/(not implemented)')
    })

    await t.test('passes through status code when status is 501', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn.statusCode, 501)
    })

    await t.test('should update value from segment normalizer rules', (t) => {
      const { agent, txn } = t.nr
      const url = 'NormalizedUri/test/explicit/string/lyrics'
      txn.forceName = url
      txn.url = url
      agent.txSegmentNormalizer.load([
        { prefix: 'WebTransaction/NormalizedUri', terms: ['test', 'string'] }
      ])
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.name, 'WebTransaction/NormalizedUri/test/*/string/*')
    })

    await t.test('should not scope web transactions to their URL', (t) => {
      const { txn } = t.nr
      txn.url = '/test/1337?action=edit'
      txn.finalizeNameFromWeb(200)
      assert.notEqual(txn.name, '/test/1337?action=edit')
      assert.notEqual(txn.name, 'WebTransaction/Uri/test/1337')
    })
  })

  await t.test('with a custom partial name set', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent({
        attributes: {
          enabled: true,
          include: ['request.parameters.*']
        }
      })
      ctx.nr.agent.config.emit('attributes.include')
      ctx.nr.txn = new Transaction(ctx.nr.agent)
      ctx.nr.txn.nameState.setPrefix('Custom')
      ctx.nr.txn.nameState.appendPath('test')
      ctx.nr.agent.transactionNameNormalizer.rules = []
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('produces a custom name when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.name, 'WebTransaction/Custom/test')
    })

    await t.test('produces a partial name when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.nameState.getName(), 'Custom/test')
    })

    await t.test('should rename a transaction when told to by a rule', (t) => {
      const { agent, txn } = t.nr
      agent.transactionNameNormalizer.addSimple('^(WebTransaction/Custom)/test$', '$1/*')
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.name, 'WebTransaction/Custom/*')
    })

    await t.test('passes through status code when status is 200', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(200)
      assert.equal(txn.statusCode, 200)
    })

    await t.test('keeps the custom name when error status is ignored', (t) => {
      const { agent, txn } = t.nr
      agent.config.error_collector.ignore_status_codes = [404, 500]
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(500)
      assert.equal(txn.name, 'WebTransaction/Custom/test')
    })

    await t.test('keeps the custom partial name when error status is ignored', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(404)
      assert.equal(txn.nameState.getName(), 'Custom/test')
    })

    await t.test('passes through status code when status is 404', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(404)
      assert.equal(txn.statusCode, 404)
    })

    await t.test('produces the custom name even when status is 501', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn.name, 'WebTransaction/Custom/test')
    })

    await t.test('produces the custom partial name even when status is 501', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn.nameState.getName(), 'Custom/test')
    })

    await t.test('passes through status code when status is 501', (t) => {
      const { txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      txn.finalizeNameFromWeb(501)
      assert.equal(txn.statusCode, 501)
    })

    await t.test('should ignore a transaction when told to by a rule', (t) => {
      const { agent, txn } = t.nr
      txn.url = '/test/string?do=thing&another=thing'
      agent.transactionNameNormalizer.addSimple('^WebTransaction/Custom/test$')
      txn.finalizeNameFromWeb(200)
      assert.ok(txn.isIgnored())
    })
  })

  await t.test('pathHashes', async (t) => {
    bookends(t)

    await t.test('should add up to 10 items to to pathHashes', (t) => {
      const { txn } = t.nr
      const toAdd = ['1', '2', '3', '4', '4', '5', '6', '7', '8', '9', '10', '11']
      const expected = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

      toAdd.forEach(txn.pushPathHash.bind(txn))
      assert.deepEqual(txn.pathHashes, expected)
    })

    await t.test('should not include current pathHash in alternatePathHashes', (t) => {
      const { agent, txn } = t.nr
      txn.name = '/a/b/c'
      txn.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        txn.name,
        txn.referringPathHash
      )

      txn.pathHashes = ['/a', curHash, '/a/b']
      assert.equal(txn.alternatePathHashes(), '/a,/a/b')
      txn.nameState.setPrefix(txn.name)
      txn.name = null
      txn.pathHashes = ['/a', '/a/b']
      assert.equal(txn.alternatePathHashes(), '/a,/a/b')
    })

    await t.test('should return null when no alternate pathHashes exist', (t) => {
      const { agent, txn } = t.nr
      txn.nameState.setPrefix('/a/b/c')
      txn.referringPathHash = '/d/e/f'

      const curHash = hashes.calculatePathHash(
        agent.config.applications()[0],
        txn.nameState.getName(),
        txn.referringPathHash
      )

      txn.pathHashes = [curHash]
      assert.equal(txn.alternatePathHashes(), null)
      txn.pathHashes = []
      assert.equal(txn.alternatePathHashes(), null)
    })
  })
})

test('Transaction methods', async (t) => {
  function bookends(t) {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent()
      ctx.nr.txn = new Transaction(ctx.nr.agent)
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })
  }

  await t.test('hasErrors', async (t) => {
    bookends(t)

    await t.test('should return true if exceptions property is not empty', (t) => {
      const { txn } = t.nr
      assert.ok(!txn.hasErrors())
      txn.exceptions.push(new Error())
      assert.ok(txn.hasErrors())
    })

    await t.test('should return true if statusCode is an error', (t) => {
      const { txn } = t.nr
      txn.statusCode = 500
      assert.ok(txn.hasErrors())
    })
  })

  await t.test('isSampled', async (t) => {
    bookends(t)

    await t.test('should be true when the transaction is sampled', (t) => {
      const { txn } = t.nr
      // the first 10 transactions are sampled so this should be true
      assert.ok(txn.isSampled())
    })

    await t.test('should be false when the transaction is not sampled', (t) => {
      const { txn } = t.nr
      txn.priority = Infinity
      txn.sampled = false
      assert.ok(!txn.isSampled())
    })
  })

  await t.test('getIntrinsicAttributes', async (t) => {
    bookends(t)

    await t.test('includes CAT attributes when enabled', (t) => {
      const { txn } = t.nr
      txn.agent.config.cross_application_tracer.enabled = true
      txn.agent.config.distributed_tracing.enabled = false
      txn.tripId = '3456'
      txn.referringTransactionGuid = '1234'
      txn.incomingCatId = '2345'

      const attributes = txn.getIntrinsicAttributes()
      assert.equal(attributes.referring_transaction_guid, '1234')
      assert.equal(attributes.client_cross_process_id, '2345')
      assert.equal(typeof attributes.path_hash, 'string')
      assert.equal(attributes.trip_id, '3456')
    })

    await t.test('includes Synthetics attributes', (t) => {
      const { txn } = t.nr
      txn.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      const attributes = txn.getIntrinsicAttributes()
      assert.equal(attributes.synthetics_resource_id, 'resId')
      assert.equal(attributes.synthetics_job_id, 'jobId')
      assert.equal(attributes.synthetics_monitor_id, 'monId')
    })

    await t.test('includes Synthetics Info attributes', (t) => {
      const { txn } = t.nr
      // spec states must be present too
      txn.syntheticsData = {}
      txn.syntheticsInfoData = {
        version: 1,
        type: 'unitTest',
        initiator: 'cli',
        attributes: {
          'Attr-Test': 'value',
          attr2Test: 'value1',
          'xTest-Header': 'value2'
        }
      }

      const attributes = txn.getIntrinsicAttributes()
      assert.equal(attributes.synthetics_type, 'unitTest')
      assert.equal(attributes.synthetics_initiator, 'cli')
      assert.equal(attributes.synthetics_attr_test, 'value')
      assert.equal(attributes.synthetics_attr_2_test, 'value1')
      assert.equal(attributes.synthetics_x_test_header, 'value2')
    })

    await t.test('returns different object every time', (t) => {
      const { txn } = t.nr
      assert.notEqual(txn.getIntrinsicAttributes(), txn.getIntrinsicAttributes())
    })

    await t.test('includes distributed trace attributes', (t) => {
      const { txn } = t.nr
      const attributes = txn.getIntrinsicAttributes()

      assert.ok(txn.priority.toString().length <= 8)
      assert.equal(attributes.guid, txn.id)
      assert.equal(attributes.traceId, txn.traceId)
      assert.equal(attributes.priority, txn.priority)
      assert.equal(attributes.sampled, true)
    })
  })

  await t.test('getResponseDurationInMillis', async (t) => {
    bookends(t)

    await t.test('for web transactions', (t) => {
      const { txn } = t.nr
      txn.url = 'someUrl'

      // add a segment that will end after the txn ends
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.end()
      childSegment.end()

      // response time should equal the transaction timer duration
      assert.equal(
        txn.getResponseTimeInMillis(),
        txn.timer.getDurationInMillis(),
        'should use the time until transaction.end() is called'
      )
    })

    await t.test('for background transactions', (t) => {
      const { txn } = t.nr
      // add a segment that will end after the transaction ends
      txn.type = Transaction.TYPES.BG
      const bgTransactionSegment = txn.trace.add('backgroundWork')
      bgTransactionSegment.start()

      txn.end()
      bgTransactionSegment.end()

      // response time should equal the full duration of the trace
      assert.equal(
        txn.getResponseTimeInMillis(),
        txn.trace.getDurationInMillis(),
        'should report response time equal to trace duration'
      )
    })
  })
})

test('_acceptDistributedTracePayload', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })
    agent.config.trusted_account_key = '1'
    // Clear deprecated values just to be extra sure.
    agent.config._process_id = null
    agent.config.account_ids = null

    agent.recordSupportability = sinon.spy()

    ctx.nr.agent = agent
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.agent = null
  })

  await t.test('records supportability metric if no payload was passed', (t) => {
    const { txn } = t.nr
    txn._acceptDistributedTracePayload(null)
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/Null'
    )
  })

  await t.test(
    'when already marked as distributed trace, records `Multiple` supportability metric if parentId exists',
    (t) => {
      const { txn } = t.nr
      txn.isDistributedTrace = true
      txn.parentId = 'exists'

      txn._acceptDistributedTracePayload({})
      assert.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/Multiple'
      )
    }
  )

  await t.test(
    'when already marked as distributed trace, records `CreateBeforeAccept` metric if parentId does not exist',
    (t) => {
      const { txn } = t.nr
      txn.isDistributedTrace = true

      txn._acceptDistributedTracePayload({})
      assert.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
      )
    }
  )

  await t.test('should not accept payload if no configured trusted key', (t) => {
    const { txn } = t.nr
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

    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Exception'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('should not accept payload if DT disabled', (t) => {
    const { txn } = t.nr
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

    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Exception'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('should accept payload if config valid and CAT disabled', (t) => {
    const { txn } = t.nr
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

    assert.ok(txn.isDistributedTrace)
  })

  await t.test('fails if payload version is above agent-supported version', (t) => {
    const { txn } = t.nr
    txn._acceptDistributedTracePayload({ v: [1, 0] })
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('fails if payload account id is not in trusted ids', (t) => {
    const { txn } = t.nr
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
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/UntrustedAccount'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('fails if payload data is missing required keys', (t) => {
    const { txn } = t.nr
    txn._acceptDistributedTracePayload({
      v: [0, 1],
      d: {
        ac: 1
      }
    })
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('takes the priority and sampled state from the incoming payload', (t) => {
    const { txn } = t.nr
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
    assert.ok(txn.sampled)
    assert.equal(txn.priority, data.pr)
    // Should not truncate accepted priority
    assert.equal(txn.priority.toString().length, 9)
  })

  await t.test('does not take the distributed tracing data if priority is missing', (t) => {
    const { txn } = t.nr
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
    assert.equal(txn.priority, null)
    assert.equal(txn.sampled, null)
  })

  await t.test('stores payload props on transaction', (t) => {
    const { txn } = t.nr
    const data = {
      ac: '1',
      ty: 'App',
      tx: txn.id,
      tr: txn.id,
      ap: 'test',
      ti: Date.now() - 1
    }

    txn._acceptDistributedTracePayload({ v: [0, 1], d: data })
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Success'
    )
    assert.equal(txn.parentId, data.tx)
    assert.equal(txn.parentType, data.ty)
    assert.equal(txn.traceId, data.tr)
    assert.ok(txn.isDistributedTrace)
    assert.ok(txn.parentTransportDuration > 0)
  })

  await t.test('should 0 transport duration when receiving payloads from the future', (t) => {
    const { txn } = t.nr
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
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Success'
    )
    assert.equal(txn.parentId, data.tx)
    assert.equal(txn.parentSpanId, txn.trace.root.id)
    assert.equal(txn.parentType, data.ty)
    assert.equal(txn.traceId, data.tr)
    assert.ok(txn.isDistributedTrace)
    assert.equal(txn.parentTransportDuration, 0)
  })
})

test('_getParsedPayload', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })

    agent.recordSupportability = sinon.spy()
    ctx.nr.agent = agent
    ctx.nr.txn = new Transaction(agent)
    ctx.nr.payload = JSON.stringify({
      test: 'payload'
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.agent = null
  })

  await t.test('returns parsed JSON object', (t) => {
    const { txn, payload } = t.nr
    const res = txn._getParsedPayload(payload)
    assert.deepEqual(res, { test: 'payload' })
  })

  await t.test('returns parsed object from base64 string', (t) => {
    const { txn, payload } = t.nr
    txn.agent.config.encoding_key = 'test'

    const res = txn._getParsedPayload(payload.toString('base64'))
    assert.deepEqual(res, { test: 'payload' })
  })

  await t.test('returns null if string is invalid JSON', (t) => {
    const { txn } = t.nr
    const res = txn._getParsedPayload('{invalid JSON string}')
    assert.equal(res, null)
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
  })

  await t.test('returns null if decoding fails', (t) => {
    const { txn, payload } = t.nr
    txn.agent.config.encoding_key = 'test'
    const newPayload = hashes.obfuscateNameUsingKey(payload, 'some other key')

    const res = txn._getParsedPayload(newPayload)
    assert.equal(res, null)
  })
})

test('_createDistributedTracePayload', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })

    agent.recordSupportability = sinon.spy()
    agent.config.account_id = '5678'
    agent.config.primary_application_id = '1234'
    agent.config.trusted_account_key = '5678'

    // Clear deprecated values just to be extra sure.
    agent.config.cross_process_id = null
    agent.config.trusted_account_ids = null

    ctx.nr.agent = agent
    ctx.nr.tracer = helper.getTracer()
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not create payload when DT disabled', (t) => {
    const { txn } = t.nr
    txn.agent.config.distributed_tracing.enabled = false

    const payload = txn._createDistributedTracePayload().text()
    assert.equal(payload, '')
    assert.equal(txn.agent.recordSupportability.callCount, 0)
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('should create payload when DT enabled and CAT disabled', (t) => {
    const { txn } = t.nr
    txn.agent.config.cross_application_tracer.enabled = false

    const payload = txn._createDistributedTracePayload().text()

    assert.notEqual(payload, null)
    assert.notEqual(payload, '')
  })

  await t.test('does not change existing priority', (t) => {
    const { txn } = t.nr
    txn.priority = 999
    txn.sampled = false

    txn._createDistributedTracePayload()

    assert.equal(txn.priority, 999)
    assert.ok(!txn.sampled)
  })

  await t.test('sets the transaction as sampled if the trace is chosen', (t) => {
    const { txn } = t.nr
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    assert.equal(payload.d.sa, txn.sampled)
    assert.equal(payload.d.pr, txn.priority)
  })

  await t.test('adds the current span id as the parent span id', (t) => {
    const { agent, txn, tracer } = t.nr
    agent.config.span_events.enabled = true
    tracer.setSegment({ segment: txn.trace.root, transaction: txn })
    txn.sampled = true
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    assert.equal(payload.d.id, txn.trace.root.id)
    tracer.setSegment({ segment: null, transaction: null })
    agent.config.span_events.enabled = false
  })

  await t.test('does not add the span id if the transaction is not sampled', (t) => {
    const { agent, txn, tracer } = t.nr
    agent.config.span_events.enabled = true
    txn._calculatePriority()
    txn.sampled = false
    tracer.setSegment({ segment: txn.trace.root, transaction: txn })
    const payload = JSON.parse(txn._createDistributedTracePayload().text())
    assert.equal(payload.d.id, undefined)
    tracer.setSegment({ segment: null, transaction: null })
    agent.config.span_events.enabled = false
  })

  await t.test('returns stringified payload object', (t) => {
    const { txn } = t.nr
    const payload = txn._createDistributedTracePayload().text()
    assert.equal(typeof payload, 'string')
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/CreatePayload/Success'
    )
    assert.ok(txn.isDistributedTrace)
  })
})

test('acceptDistributedTraceHeaders', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true },
      span_events: { enabled: true }
    })
    ctx.nr.agent.config.trusted_account_key = '1'
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should accept a valid trace context traceparent header', (t, end) => {
    const { agent } = t.nr
    const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    const headers = {
      traceparent: goodParent
    }

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.acceptDistributedTraceHeaders('HTTP', headers)

      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')

      txn.end()
      end()
    })
  })

  await t.test('should not accept invalid trace context traceparent header', (t, end) => {
    const { agent } = t.nr
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

      assert.equal(secondHeaders.traceparent, origTraceparent)
      txn.end()
      end()
    })
  })

  await t.test('should use newrelic format when no traceparent', (t, end) => {
    const { agent } = t.nr
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

      assert.ok(txn.isDistributedTrace)
      assert.ok(txn.acceptedDistributedTrace)

      const outboundHeaders = createHeadersAndInsertTrace(txn)
      const splitData = outboundHeaders.traceparent.split('-')
      const [, traceId] = splitData

      assert.equal(traceId, expectedTraceId)
      txn.end()
      end()
    })
  })

  await t.test('should not throw error when headers is a string', (t, end) => {
    const { agent } = t.nr
    const trustedAccountKey = '123'
    agent.config.trusted_account_key = trustedAccountKey

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      const headers = 'JUST A STRING'

      assert.doesNotThrow(function () {
        txn.acceptDistributedTraceHeaders('HTTP', headers)
      })

      assert.equal(txn.isDistributedTrace, null)
      assert.equal(txn.acceptedDistributedTrace, null)

      txn.end()
      end()
    })
  })

  await t.test('should only accept the first tracecontext', (t, end) => {
    const { agent } = t.nr
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

      assert.equal(txn.traceId, expectedTraceId)
      assert.equal(txn.parentSpanId, expectedParentSpanId)
      assert.equal(txn.parentApp, '2827902')

      txn.end()
      end()
    })
  })

  await t.test('should not accept tracecontext after sending a trace', (t, end) => {
    const { agent } = t.nr
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

      assert.notEqual(txn.traceId, unexpectedTraceId)
      assert.notEqual(txn.parentSpanId, unexpectedParentSpanId)
      assert.notEqual(txn.parentApp, '2827902')

      const traceparentParts = outboundHeaders.traceparent.split('-')
      const [, expectedTraceId] = traceparentParts

      assert.equal(txn.traceId, expectedTraceId)

      txn.end()
      end()
    })
  })
})

test('insertDistributedTraceHeaders', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.tracer = helper.getTracer()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should lowercase traceId for tracecontext when received upper from newrelic format',
    (t, end) => {
      const { agent } = t.nr
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

        assert.ok(txn.isDistributedTrace)
        assert.ok(txn.acceptedDistributedTrace)

        const insertedHeaders = {}
        txn.insertDistributedTraceHeaders(insertedHeaders)

        const splitData = insertedHeaders.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceContextTraceId)

        const rawPayload = Buffer.from(insertedHeaders.newrelic, 'base64').toString('utf-8')
        const payload = JSON.parse(rawPayload)

        // newrelic header should have traceId untouched
        assert.equal(payload.d.tr, incomingTraceId)

        // traceId used for metrics shoudl go untouched
        assert.equal(txn.traceId, incomingTraceId)

        txn.end()
        end()
      })
    }
  )

  await t.test('should generate a valid new trace context traceparent header', (t) => {
    const { agent, tracer } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)

    tracer.setSegment({ transaction: txn, segment: txn.trace.root })

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    const lowercaseHexRegex = /^[a-f0-9]+/

    assert.equal(traceparentParts.length, 4)
    assert.equal(traceparentParts[0], '00', 'version matches')
    assert.equal(traceparentParts[1].length, 32, 'traceId of length 32')
    assert.equal(traceparentParts[2].length, 16, 'parentId of length 16')
    assert.equal(traceparentParts[3], '01', 'flags match')

    assert.match(traceparentParts[1], lowercaseHexRegex, 'traceId is lowercase hex')
    assert.match(traceparentParts[2], lowercaseHexRegex, 'parentId is lowercase hex')
  })

  await t.test('should generate new parentId when spans_events disabled', (t) => {
    const { agent, tracer } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = false

    const txn = new Transaction(agent)
    const lowercaseHexRegex = /^[a-f0-9]+/

    tracer.setSegment({ transaction: txn, segment: txn.trace.root })

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    assert.equal(traceparentParts[2].length, 16, 'parentId has length 16')

    assert.match(traceparentParts[2], lowercaseHexRegex, 'parentId is lowercase hex')
  })

  await t.test('should set traceparent sample part to 01 for sampled transaction', (t) => {
    const { agent, tracer } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)

    tracer.setSegment({ transaction: txn, segment: txn.trace.root })
    txn.sampled = true

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparent = outboundHeaders.traceparent
    const traceparentParts = traceparent.split('-')

    assert.equal(traceparentParts[3], '01', 'flags match')
  })

  await t.test('should set traceparent traceid if traceparent exists on transaction', (t) => {
    const { agent, tracer } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const txn = new Transaction(agent)
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
    const tracestate = '323322332234234234423'

    txn.acceptTraceContextPayload(traceparent, tracestate)

    tracer.setSegment({ transaction: txn, segment: txn.trace.root })

    const outboundHeaders = createHeadersAndInsertTrace(txn)
    const traceparentParts = outboundHeaders.traceparent.split('-')

    assert.equal(traceparentParts[1], '4bf92f3577b34da6a3ce929d0e0e4736', 'traceId matches')
  })

  await t.test('generates a priority for entry-point transactions', (t) => {
    const { agent } = t.nr
    const txn = new Transaction(agent)

    assert.equal(txn.priority, null)
    assert.equal(txn.sampled, null)

    txn.insertDistributedTraceHeaders({})

    assert.equal(typeof txn.priority, 'number')
    assert.equal(typeof txn.sampled, 'boolean')
  })

  await t.test('should build traceparent from spanContext', (t) => {
    const { agent } = t.nr
    const trustedAccountKey = '123'

    agent.config.account_id = 'AccountId1'
    agent.config.primary_application_id = 'Application1'
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = trustedAccountKey
    agent.config.span_events.enabled = true
    const txn = new Transaction(agent)
    const traceId = hashes.makeId(32)
    const spanId = hashes.makeId()
    const spanContext = {
      traceId,
      spanId,
      traceFlags: 1

    }
    const headers = {}
    const setter = {
      set(carrier, header, value) {
        carrier[header] = value
      }
    }
    txn.insertDistributedTraceHeaders(headers, setter, spanContext)
    const { traceparent, tracestate } = headers
    assert.equal(traceparent, `00-${traceId}-${spanId}-01`)
    assert.ok(tracestate.startsWith(`${trustedAccountKey}@nr=0-0-AccountId1-Application1-${spanId}-${txn.id}`))
  })

  await t.test('should not set newrelic header if empty string', (t) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.span_events.enabled = true
    const txn = new Transaction(agent)
    const headers = {}
    txn.insertDistributedTraceHeaders(headers)
    assert.ok(headers.traceparent)
    assert.ok(!Object.prototype.hasOwnProperty.call(headers, 'tracestate'))
    assert.ok(!Object.prototype.hasOwnProperty.call(headers, 'newrelic'))
  })
})

test('acceptTraceContextPayload', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should accept a valid trace context traceparent header', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.acceptTraceContextPayload(goodParent, 'stuff')

      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')

      txn.end()
      end()
    })
  })

  await t.test('should not accept invalid trace context traceparent header', (t, end) => {
    const { agent } = t.nr
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

      assert.equal(secondHeaders.traceparent, origTraceparent)
      txn.end()
      end()
    })
  })

  await t.test('should not accept tracestate when trusted_account_key missing', (t, end) => {
    const { agent } = t.nr
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
      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')

      // tracestate
      assert.equal(txn.parentType, null)
      assert.equal(txn.accountId, undefined)
      assert.equal(txn.parentApp, null)
      assert.equal(txn.parentId, null)

      txn.end()
      end()
    })
  })

  await t.test('should accept tracestate when trusted_account_key matches', (t, end) => {
    const { agent } = t.nr
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
      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')

      // tracestate
      assert.equal(txn.parentType, 'App')
      assert.equal(txn.parentAcct, '33')
      assert.equal(txn.parentApp, '2827902')
      assert.equal(txn.parentId, 'e8b91a159289ff74')

      txn.end()
      end()
    })
  })
})

test('addDistributedTraceIntrinsics', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })
    ctx.nr.attributes = {}
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('does not change existing priority', (t) => {
    const { txn, attributes } = t.nr
    txn.priority = 999
    txn.sampled = false

    txn.addDistributedTraceIntrinsics(attributes)

    assert.equal(txn.priority, 999)
    assert.ok(!txn.sampled)
  })

  await t.test('adds expected attributes if no payload was received', (t) => {
    const { txn, attributes } = t.nr
    txn.isDistributedTrace = false

    txn.addDistributedTraceIntrinsics(attributes)

    const expected = {
      guid: txn.id,
      traceId: txn.traceId,
      priority: txn.priority,
      sampled: true
    }
    assert.deepEqual(attributes, expected)
  })

  await t.test('adds DT attributes if payload was accepted', (t) => {
    const { txn, attributes } = t.nr
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

    assert.equal(attributes['parent.type'], expected['parent.type'])
    assert.equal(attributes['parent.app'], expected['parent.app'])
    assert.equal(attributes['parent.account'], expected['parent.account'])
    assert.equal(attributes['parent.transportType'], expected['parent.transportType'])
    assert.notEqual(attributes['parent.transportDuration'], null)
  })
})

test('transaction end', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })

    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should clear errors', (t) => {
    const { txn } = t.nr
    txn.userErrors.push(new Error('user sadness'))
    txn.exceptions.push(new Error('things went bad'))

    txn.end()

    assert.equal(txn.userErrors, null)
    assert.equal(txn.exceptions, null)
  })

  await t.test('should not clear errors until after transactionFinished event', (t, end) => {
    const { agent, txn } = t.nr
    txn.userErrors.push(new Error('user sadness'))
    txn.exceptions.push(new Error('things went bad'))

    agent.on('transactionFinished', (endedTransaction) => {
      assert.equal(endedTransaction.userErrors.length, 1)
      assert.equal(endedTransaction.exceptions.length, 1)

      end()
    })

    txn.end()
  })
})

test('when being named with finalizeNameFromWeb', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })
    ctx.nr.tracer = helper.getTracer()
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  // TODO: test no longer valid
  /*
  await t.test('should throw when called with no parameters', (t) => {
    const { txn } = t.nr
    assert.throws(() => txn.finalizeNameFromWeb())
  })
  */

  await t.test('should ignore a request path when told to by a rule', (t) => {
    const { agent, txn } = t.nr
    const api = new API(agent)
    api.addIgnoringRule('^/test/')

    txn.url = '/test/string?do=thing&another=thing'
    txn.finalizeNameFromWeb(200)

    assert.equal(txn.isIgnored(), true)
  })

  await t.test('should ignore a transaction when told to by a rule', (t) => {
    const { agent, txn } = t.nr
    agent.transactionNameNormalizer.addSimple('^WebTransaction/NormalizedUri')

    txn.url = '/test/string?do=thing&another=thing'
    txn.finalizeNameFromWeb(200)

    assert.equal(txn.isIgnored(), true)
  })

  await t.test('should pass through a name when told to by a rule', (t) => {
    const { agent, txn } = t.nr
    agent.userNormalizer.addSimple('^/config', '/foobar')

    txn.url = '/config'
    txn.finalizeNameFromWeb(200)

    assert.equal(txn.name, 'WebTransaction/NormalizedUri/foobar')
  })

  await t.test('should add finalized via rule transaction name to active span intrinsics', (t) => {
    const { agent, txn, tracer } = t.nr
    agent.userNormalizer.addSimple('^/config', '/foobar')

    addSegmentInContext(tracer, txn, 'test segment')

    txn.url = '/config'
    txn.finalizeNameFromWeb(200)

    const spanContext = agent.tracer.getSpanContext()
    const intrinsics = spanContext.intrinsicAttributes

    assert.ok(intrinsics)
    assert.equal(intrinsics['transaction.name'], 'WebTransaction/NormalizedUri/foobar')
  })

  await t.test('when namestate populated should use name stack', (t) => {
    const { txn } = t.nr
    setupNameState(txn)

    txn.url = '/some/random/path'
    txn.finalizeNameFromWeb(200)

    assert.equal(txn.name, 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')
  })

  await t.test('when namestate populated should copy parameters from the name stack', (t) => {
    const { txn } = t.nr
    setupNameState(txn)

    txn.url = '/some/random/path'
    txn.finalizeNameFromWeb(200)

    const attrs = txn.trace.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE)

    assert.deepEqual(attrs, {
      'request.parameters.foo': 'biz',
      'request.parameters.bar': 'bang'
    })
  })

  await t.test(
    'when namestate populated, ' +
      'should add finalized via rule transaction name to active span intrinsics',
    (t) => {
      const { agent, txn, tracer } = t.nr
      setupNameState(txn)
      addSegmentInContext(tracer, txn, 'test segment')

      txn.url = '/some/random/path'
      txn.finalizeNameFromWeb(200)

      const spanContext = agent.tracer.getSpanContext()
      const intrinsics = spanContext.intrinsicAttributes

      assert.ok(intrinsics)
      assert.equal(intrinsics['transaction.name'], 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')
    }
  )

  await t.test('when namestate populated and high_security enabled, should use name stack', (t) => {
    const { agent, txn } = t.nr
    setupNameState(txn)
    setupHighSecurity(agent)

    txn.url = '/some/random/path'
    txn.finalizeNameFromWeb(200)

    assert.equal(txn.name, 'WebTransaction/Restify/COOL//foo/:foo/bar/:bar')
  })

  await t.test(
    'when namestate populated and high_security enabled, ' +
      'should not copy parameters from the name stack',
    (t) => {
      const { agent, txn } = t.nr
      setupNameState(txn)
      setupHighSecurity(agent)

      txn.url = '/some/random/path'
      txn.finalizeNameFromWeb(200)

      const attrs = txn.trace.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE)
      assert.deepEqual(attrs, {})
    }
  )
})

test('requestd', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
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

    ctx.nr.tracer = helper.getTracer()
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('when namestate populated should copy parameters from the name stack', (t) => {
    const { txn, tracer } = t.nr
    setupNameState(txn)

    addSegmentInContext(tracer, txn, 'test segment')

    txn.finalizeNameFromWeb(200)

    const segment = tracer.getSegment()

    assert.deepEqual(segment.attributes.get(AttributeFilter.DESTINATIONS.SPAN_EVENT), {
      'request.parameters.foo': 'biz',
      'request.parameters.bar': 'bang'
    })
  })
})

test('when being named with finalizeName', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      },
      distributed_tracing: {
        enabled: true
      }
    })

    ctx.nr.tracer = helper.getTracer()
    ctx.nr.txn = new Transaction(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should call finalizeNameFromWeb if no name is given for a web txn', (t) => {
    const { txn } = t.nr
    let called = false

    txn.finalizeNameFromWeb = () => {
      called = true
    }
    txn.type = 'web'
    txn.url = '/foo/bar'
    txn.finalizeName()

    assert.ok(called)
  })

  await t.test('should apply ignore rules', (t) => {
    const { agent, txn } = t.nr
    agent.transactionNameNormalizer.addSimple('foo') // Ignore foo

    txn.finalizeName('foo')

    assert.equal(txn.isIgnored(), true)
  })

  await t.test('should not apply user naming rules', (t) => {
    const { agent, txn } = t.nr
    agent.userNormalizer.addSimple('^/config', '/foobar')

    txn.finalizeName('/config')

    assert.equal(txn.getFullName(), 'WebTransaction//config')
  })

  await t.test('should add finalized transaction name to active span intrinsics', (t) => {
    const { agent, txn, tracer } = t.nr
    addSegmentInContext(tracer, txn, 'test segment')

    txn.finalizeName('/config')

    const spanContext = agent.tracer.getSpanContext()
    const intrinsics = spanContext.intrinsicAttributes

    assert.ok(intrinsics)
    assert.equal(intrinsics['transaction.name'], 'WebTransaction//config')
  })
})

function setupNameState(transaction) {
  transaction.baseSegment = transaction.trace.add('basesegment')
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

function addSegmentInContext(tracer, transaction, name) {
  const segment = new Segment({
    config: transaction.agent.config,
    name,
    root: transaction.trace.root
  })
  tracer.setSegment({ transaction, segment })

  return segment
}
