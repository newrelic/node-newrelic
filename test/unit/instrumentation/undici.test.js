/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const hashes = require('../../../lib/util/hashes')
const HOST = 'https://www.example.com'

test('undici instrumentation', async function (t) {
  const sandbox = sinon.createSandbox()
  const diagnosticsChannel = require('diagnostics_channel')
  const channels = {
    create: diagnosticsChannel.channel('undici:request:create'),
    headers: diagnosticsChannel.channel('undici:request:headers'),
    send: diagnosticsChannel.channel('undici:request:trailers'),
    error: diagnosticsChannel.channel('undici:request:error')
  }
  const agent = helper.loadMockedAgent()
  agent.config.distributed_tracing.enabled = false
  agent.config.cross_application_tracer.enabled = false
  const shim = new TransactionShim(agent, 'undici')
  const loggerMock = require('../mocks/logger')(sandbox)
  const undiciInstrumentation = proxyquire('../../../lib/instrumentation/undici', {
    '../logger': {
      child: sandbox.stub().callsFake(() => loggerMock)
    }
  })
  undiciInstrumentation(agent, 'undici', 'undici', shim)

  t.afterEach(function () {
    sandbox.resetHistory()
    agent.config.distributed_tracing.enabled = false
    agent.config.cross_application_tracer.enabled = false
    helper.unloadAgent(agent)
  })

  await t.test('request:create', async function (t) {
    await t.test('should log trace if request is not in an active transaction', function (t, end) {
      channels.create.publish({ request: { origin: HOST, path: '/foo' } })
      assert.deepEqual(loggerMock.trace.args[0], [
        'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
        '/foo',
        undefined
      ])
      end()
    })

    await t.test('should not add headers when segment is opaque', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const segment = tx.trace.add('parent')
        segment.opaque = true
        segment.start()
        shim.setActiveSegment(segment)
        channels.create.publish({ request: { origin: HOST, path: '/foo' } })
        assert.ok(loggerMock.trace.callCount, 1)
        assert.deepEqual(loggerMock.trace.args[0], [
          'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
          '/foo',
          'parent'
        ])
        tx.end()
        end()
      })
    })

    await t.test('should add synthetics header when it exists on transaction', function (t, end) {
      agent.config.encoding_key = 'encKey'
      helper.runInTransaction(agent, function (tx) {
        tx.syntheticsHeader = 'synthHeader'
        tx.syntheticsInfoHeader = 'synthInfoHeader'
        const request = {
          addHeader: sandbox.stub(),
          origin: HOST,
          path: '/foo-2'
        }
        channels.create.publish({ request })
        const context = agent.tracer.getContext()
        assert.ok(context.extras.undiciParent)
        assert.ok(context.transaction)
        assert.equal(request.addHeader.callCount, 2)
        assert.deepEqual(request.addHeader.args[0], ['x-newrelic-synthetics', 'synthHeader'])
        assert.deepEqual(request.addHeader.args[1], [
          'x-newrelic-synthetics-info',
          'synthInfoHeader'
        ])
        tx.end()
        end()
      })
    })

    await t.test('should add DT headers when `distributed_tracing` is enabled', function (t, end) {
      agent.config.distributed_tracing.enabled = true
      helper.runInTransaction(agent, function (tx) {
        const addHeader = sandbox.stub()
        channels.create.publish({ request: { origin: HOST, path: '/foo-2', addHeader } })
        assert.equal(addHeader.callCount, 1)
        assert.equal(addHeader.args[0][0], 'traceparent')
        assert.match(addHeader.args[0][1], /^[\w-]{55}$/)
        tx.end()
        end()
      })
    })

    await t.test(
      'should add CAT headers when `cross_application_tracer` is enabled',
      function (t, end) {
        agent.config.cross_application_tracer.enabled = true
        helper.runInTransaction(agent, function (tx) {
          const addHeader = sandbox.stub()
          channels.create.publish({ request: { origin: HOST, path: '/foo-2', addHeader } })
          assert.equal(addHeader.callCount, 1)
          assert.equal(addHeader.args[0][0], 'X-NewRelic-Transaction')
          assert.match(addHeader.args[0][1], /^[\w/-]{60,80}={0,2}$/)
          tx.end()
          end()
        })
      }
    )

    await t.test(
      'should name segment with appropriate attrs based on request.path',
      function (t, end) {
        helper.runInTransaction(agent, function (tx) {
          const request = {
            method: 'POST',
            origin: 'https://unittesting.com',
            path: '/foo?a=b&c=d'
          }
          let context = agent.tracer.getContext()
          const parent = shim.createSegment({
            name: 'parent',
            parent: tx.trace.root
          })
          context.extras = { undiciParent: parent }
          channels.create.publish({ request })
          context = agent.tracer.getContext()
          assert.ok(context.extras.undiciParent)
          assert.ok(context.transaction)
          assert.ok(context.extras.undiciSegment)
          const segment = shim.getSegment()
          assert.equal(segment.name, 'External/unittesting.com/foo')
          const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
          assert.equal(attrs.url, 'https://unittesting.com/foo')
          assert.equal(attrs.procedure, 'POST')
          assert.equal(attrs['request.parameters.a'], 'b')
          assert.equal(attrs['request.parameters.c'], 'd')
          tx.end()
          end()
        })
      }
    )

    await t.test('should use proper url if http', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const request = {
          method: 'POST',
          origin: 'http://unittesting.com',
          path: '/http'
        }
        const context = agent.tracer.getContext()
        const parent = shim.createSegment({
          name: 'parent',
          parent: tx.trace.root
        })
        context.extras = { undiciParent: parent }
        channels.create.publish({ request })
        const segment = shim.getSegment()
        assert.equal(segment.name, 'External/unittesting.com/http')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        assert.equal(attrs.url, 'http://unittesting.com/http')
        tx.end()
        end()
      })
    })

    await t.test('should use port in https if not 443', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const request = {
          origin: 'https://unittesting.com:9999',
          method: 'POST',
          path: '/port-https'
        }
        const context = agent.tracer.getContext()
        const parent = shim.createSegment({
          name: 'parent',
          parent: tx.trace.root
        })
        context.extras = { undiciParent: parent }
        channels.create.publish({ request })
        const segment = shim.getSegment()
        assert.equal(segment.name, 'External/unittesting.com:9999/port-https')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        assert.equal(attrs.url, 'https://unittesting.com:9999/port-https')
        tx.end()
        end()
      })
    })

    await t.test('should use port in http if not 80', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const request = {
          origin: 'http://unittesting.com:8080',
          method: 'POST',
          path: '/port-http'
        }
        const context = agent.tracer.getContext()
        const parent = shim.createSegment({
          name: 'parent',
          parent: tx.trace.root
        })
        context.extras = { undiciParent: parent }
        channels.create.publish({ request })
        const segment = shim.getSegment()
        assert.equal(segment.name, 'External/unittesting.com:8080/port-http')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        assert.equal(attrs.url, 'http://unittesting.com:8080/port-http')
        tx.end()
        end()
      })
    })

    await t.test('should log warning if it fails to create external segment', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const request = {
          origin: 'blah',
          method: 'POST',
          path: '/port-http'
        }
        const context = agent.tracer.getContext()
        const parent = shim.createSegment({
          name: 'parent',
          parent: tx.trace.root
        })
        context.extras = { undiciParent: parent }
        channels.create.publish({ request })
        const segment = shim.getSegment()
        assert.equal(segment.name, 'ROOT', 'should not create a new segment if URL fails to parse')
        assert.equal(loggerMock.warn.callCount, 1, 'logs warning')
        assert.equal(loggerMock.warn.args[0][0].message, 'Invalid URL')
        assert.equal(loggerMock.warn.args[0][1], 'Unable to create external segment')
        tx.end()
        end()
      })
    })
  })

  await t.test('request:headers', async function (t) {
    await t.test(
      'should not add span attrs when there is not an active segment',
      function (t, end) {
        helper.runInTransaction(agent, function (tx) {
          channels.headers.publish({})
          const segment = shim.getSegment()
          const attrs = segment.getAttributes()
          assert.deepEqual(Object.keys(attrs), [])
          tx.end()
          end()
        })
      }
    )

    await t.test('should add statusCode and statusText from response', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const segment = shim.createSegment({ name: 'active', parent: tx.trace.root })
        const context = agent.tracer.getContext()
        context.extras = { undiciSegment: segment }
        const response = {
          statusCode: 200,
          statusText: 'OK'
        }
        channels.headers.publish({ response })
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        assert.equal(attrs['http.statusCode'], 200)
        assert.equal(attrs['http.statusText'], 'OK')
        tx.end()
        end()
      })
    })

    await t.test('should rename segment based on CAT data', function (t, end) {
      agent.config.cross_application_tracer.enabled = true
      agent.config.encoding_key = 'testing-key'
      agent.config.trusted_account_ids = [111]
      helper.runInTransaction(agent, function (tx) {
        const context = agent.tracer.getContext()
        const segment = shim.createSegment({ name: 'active', parent: tx.trace.root })
        segment.addAttribute('url', 'https://www.unittesting.com/path')
        context.extras = { undiciSegment: segment }
        const response = {
          headers: {
            'x-newrelic-app-data': hashes.obfuscateNameUsingKey(
              JSON.stringify(['111#456', 'abc', 0, 0, -1, 'xyz']),
              agent.config.encoding_key
            )
          },
          statusCode: 200,
          statusText: 'OK'
        }
        channels.headers.publish({ response })
        assert.equal(segment.name, 'ExternalTransaction/www.unittesting.com/111#456/abc')
        tx.end()
        end()
      })
    })
  })

  await t.test('request:trailers', async function (t) {
    await t.test('should end current segment and restore to parent', function (t, end) {
      helper.runInTransaction(agent, function (tx) {
        const parentSegment = shim.createSegment({ name: 'parent', parent: tx.trace.root })
        const segment = shim.createSegment({ name: 'active', parent: tx.trace.root })
        const context = agent.tracer.getContext()
        context.extras = { undiciSegment: segment, undiciParent: parentSegment }
        shim.setActiveSegment(segment)
        channels.send.publish({})
        assert.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
        assert.equal(parentSegment.id, shim.getSegment().id, 'parentSegment should now the active')
        tx.end()
        end()
      })
    })
  })

  await t.test('request:error', async function (t) {
    await t.test(
      'should end current segment and restore to parent and add error to active transaction',
      function (t, end) {
        helper.runInTransaction(agent, function (tx) {
          sandbox.stub(tx.agent.errors, 'add')
          const parentSegment = shim.createSegment({ name: 'parent', parent: tx.trace.root })
          const segment = shim.createSegment({ name: 'active', parent: tx.trace.root })
          const context = agent.tracer.getContext()
          context.extras = { undiciSegment: segment, undiciParent: parentSegment }
          shim.setActiveSegment(segment)
          const error = new Error('request failed')
          channels.error.publish({ error })
          assert.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
          assert.equal(
            parentSegment.id,
            shim.getSegment().id,
            'parentSegment should now the active'
          )
          assert.deepEqual(loggerMock.trace.args[0], [
            error,
            'Captured outbound error on behalf of the user.'
          ])
          assert.equal(tx.agent.errors.add.args[0][0].id, tx.id)
          assert.equal(tx.agent.errors.add.args[0][1].message, error.message)
          tx.agent.errors.add.restore()
          tx.end()
          end()
        })
      }
    )
  })
})
