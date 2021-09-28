/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const semver = require('semver')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const hashes = require('../../../lib/util/hashes')

// diagnostics_channel only exists in Node 15+
// but we only support even versions so check before running tests
const shouldSkip = semver.satisfies(process.version, '<16')

tap.test('undici instrumentation', { skip: shouldSkip }, function (t) {
  let agent
  let loggerMock
  let undiciInstrumentation
  let channels
  let shim
  let SYMBOLS
  let sandbox

  t.autoend()

  t.before(function () {
    sandbox = sinon.createSandbox()
    const diagnosticsChannel = require('diagnostics_channel')
    channels = {
      create: diagnosticsChannel.channel('undici:request:create'),
      sendHeaders: diagnosticsChannel.channel('undici:client:sendHeaders'),
      headers: diagnosticsChannel.channel('undici:request:headers'),
      send: diagnosticsChannel.channel('undici:request:trailers'),
      error: diagnosticsChannel.channel('undici:request:error'),
      beforeConnect: diagnosticsChannel.channel('undici:client:beforeConnect'),
      connected: diagnosticsChannel.channel('undici:client:connected'),
      connectError: diagnosticsChannel.channel('undici:client:connectError')
    }
    agent = helper.loadMockedAgent()
    agent.config.distributed_tracing.enabled = false
    agent.config.cross_application_tracer.enabled = false
    agent.config.feature_flag = {
      undici_instrumentation: true
    }
    shim = new TransactionShim(agent, 'undici')
    loggerMock = require('../mocks/logger')(sandbox)
    undiciInstrumentation = proxyquire('../../../lib/instrumentation/undici', {
      '../logger': {
        child: sandbox.stub().callsFake(() => loggerMock)
      }
    })
    undiciInstrumentation(agent, 'undici', 'undici', shim)
    SYMBOLS = undiciInstrumentation.SYMBOLS
  })

  function afterEach() {
    sandbox.resetHistory()
    agent.config.distributed_tracing.enabled = false
    agent.config.cross_application_tracer.enabled = false
    helper.unloadAgent(agent)
  }

  t.test('should log warning if feature flag is not enabled', function (t) {
    agent.config.feature_flag.undici_instrumentation = false
    undiciInstrumentation(agent)
    t.same(loggerMock.warn.args[0], [
      'diagnostics_channel or feature_flag.undici_instrumentation = false. Skipping undici instrumentation.'
    ])
    t.end()
  })

  t.test('request:create', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should not add headers when segment is opaque', function (t) {
      helper.runInTransaction(agent, function (tx) {
        const segment = tx.trace.add('parent')
        segment.opaque = true
        segment.start()
        shim.setActiveSegment(segment)
        channels.create.publish({ request: { path: '/foo' } })
        t.ok(loggerMock.trace.callCount, 1)
        t.same(loggerMock.trace.args[0], [
          'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
          '/foo',
          'parent'
        ])
        t.end()
      })
    })

    t.test('should add synthetics header when it exists on transaction', function (t) {
      agent.config.encoding_key = 'encKey'
      helper.runInTransaction(agent, function (tx) {
        tx.syntheticsHeader = 'synthHeader'
        const request = {
          addHeader: sandbox.stub(),
          path: '/foo-2'
        }
        channels.create.publish({ request })
        t.ok(request[SYMBOLS.PARENT_SEGMENT])
        t.equal(request.addHeader.callCount, 1)
        t.same(request.addHeader.args[0], ['x-newrelic-synthetics', 'synthHeader'])
        t.end()
      })
    })

    t.test('should add DT headers when `distributed_tracing` is enabled', function (t) {
      agent.config.distributed_tracing.enabled = true
      helper.runInTransaction(agent, function () {
        const addHeader = sandbox.stub()
        channels.create.publish({ request: { path: '/foo-2', addHeader } })
        t.equal(addHeader.callCount, 2)
        t.equal(addHeader.args[0][0], 'traceparent')
        t.match(addHeader.args[0][1], /^[\w\d\-]{55}$/)
        t.same(addHeader.args[1], ['newrelic', ''])
        t.end()
      })
    })

    t.test('should add CAT headers when `cross_application_tracer` is enabled', function (t) {
      agent.config.cross_application_tracer.enabled = true
      helper.runInTransaction(agent, function () {
        const addHeader = sandbox.stub()
        channels.create.publish({ request: { path: '/foo-2', addHeader } })
        t.equal(addHeader.callCount, 1)
        t.equal(addHeader.args[0][0], 'X-NewRelic-Transaction')
        t.match(addHeader.args[0][1], /^[\w\d/-]{60,80}={0,2}$/)
        t.end()
      })
    })
  })

  t.test('client:sendHeaders', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should not create segment is parent segment is opaque', function (t) {
      helper.runInTransaction(agent, function () {
        const before = shim.getSegment()
        const request = {}
        request[SYMBOLS.PARENT_SEGMENT] = { opaque: true }
        channels.sendHeaders.publish({ request })
        const after = shim.getSegment()
        t.same(before, after)
        t.end()
      })
    })

    t.test('should name segment with appropriate attrs based on request.path', function (t) {
      helper.runInTransaction(agent, function () {
        const socket = {
          remotePort: 443,
          servername: 'unittesting.com'
        }
        const request = {
          method: 'POST',
          path: '/foo?a=b&c=d'
        }
        request[SYMBOLS.PARENT_SEGMENT] = shim.createSegment('parent')
        channels.sendHeaders.publish({ request, socket })
        t.ok(request[SYMBOLS.SEGMENT])
        const segment = shim.getSegment()
        t.equal(segment.name, 'External/unittesting.com/foo')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        t.equal(attrs.url, 'https://unittesting.com/foo')
        t.equal(attrs.procedure, 'POST')
        t.equal(attrs['request.parameters.a'], 'b')
        t.equal(attrs['request.parameters.c'], 'd')
        t.end()
      })
    })

    t.test('should use proper url if http', function (t) {
      helper.runInTransaction(agent, function () {
        const socket = {
          remotePort: 80,
          _host: 'unittesting.com'
        }
        const request = {
          method: 'POST',
          path: '/http'
        }
        request[SYMBOLS.PARENT_SEGMENT] = shim.createSegment('parent')
        channels.sendHeaders.publish({ request, socket })
        const segment = shim.getSegment()
        t.equal(segment.name, 'External/unittesting.com/http')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        t.equal(attrs.url, 'http://unittesting.com/http')
        t.end()
      })
    })

    t.test('should use port in https if not 443', function (t) {
      helper.runInTransaction(agent, function () {
        const socket = {
          remotePort: 9999,
          servername: 'unittesting.com'
        }
        const request = {
          method: 'POST',
          path: '/port-https'
        }
        request[SYMBOLS.PARENT_SEGMENT] = shim.createSegment('parent')
        channels.sendHeaders.publish({ request, socket })
        const segment = shim.getSegment()
        t.equal(segment.name, 'External/unittesting.com:9999/port-https')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        t.equal(attrs.url, 'https://unittesting.com:9999/port-https')
        t.end()
      })
    })

    t.test('should use port in http if not 80', function (t) {
      helper.runInTransaction(agent, function () {
        const socket = {
          remotePort: 8080,
          _host: 'unittesting.com'
        }
        const request = {
          method: 'POST',
          path: '/port-http'
        }
        request[SYMBOLS.PARENT_SEGMENT] = shim.createSegment('parent')
        channels.sendHeaders.publish({ request, socket })
        const segment = shim.getSegment()
        t.equal(segment.name, 'External/unittesting.com:8080/port-http')
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        t.equal(attrs.url, 'http://unittesting.com:8080/port-http')
        t.end()
      })
    })
  })

  t.test('request:headers', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should not add span attrs when there is not an active segment', function (t) {
      helper.runInTransaction(agent, function () {
        channels.headers.publish({ request: {} })
        const segment = shim.getSegment()
        const attrs = segment.getAttributes()
        t.same(Object.keys(attrs), [])
        t.end()
      })
    })

    t.test('should add statusCode and statusText from response', function (t) {
      helper.runInTransaction(agent, function () {
        const segment = shim.createSegment('active')
        const request = {
          [SYMBOLS.SEGMENT]: segment
        }
        const response = {
          statusCode: 200,
          statusText: 'OK'
        }
        channels.headers.publish({ request, response })
        const attrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
        t.equal(attrs['http.statusCode'], 200)
        t.equal(attrs['http.statusText'], 'OK')
        t.end()
      })
    })

    t.test('should rename segment based on CAT data', function (t) {
      agent.config.cross_application_tracer.enabled = true
      agent.config.encoding_key = 'testing-key'
      agent.config.trusted_account_ids = [111]
      helper.runInTransaction(agent, function () {
        const segment = shim.createSegment('active')
        segment.addAttribute('url', 'https://www.unittesting.com/path')
        const request = {
          [SYMBOLS.SEGMENT]: segment
        }
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
        channels.headers.publish({ request, response })
        t.equal(segment.name, 'ExternalTransaction/www.unittesting.com/111#456/abc')
        t.end()
      })
    })
  })

  t.test('request:trailers', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should end current segment and restore to parent', function (t) {
      helper.runInTransaction(agent, function () {
        const parentSegment = shim.createSegment('parent')
        const segment = shim.createSegment('active')
        shim.setActiveSegment(segment)
        const request = {
          [SYMBOLS.PARENT_SEGMENT]: parentSegment,
          [SYMBOLS.SEGMENT]: segment
        }
        channels.send.publish({ request })
        t.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
        t.same(parentSegment, shim.getSegment(), 'parentSegment should now the active')
        t.end()
      })
    })
  })

  t.test('request:error', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test(
      'should end current segment and restore to parent and add error to active transaction',
      function (t) {
        helper.runInTransaction(agent, function (tx) {
          sandbox.stub(tx.agent.errors, 'add')
          const parentSegment = shim.createSegment('parent')
          const segment = shim.createSegment('active')
          shim.setActiveSegment(segment)
          const error = new Error('request failed')
          const request = {
            [SYMBOLS.PARENT_SEGMENT]: parentSegment,
            [SYMBOLS.SEGMENT]: segment
          }
          channels.error.publish({ request, error })
          t.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
          t.same(parentSegment, shim.getSegment(), 'parentSegment should now the active')
          t.same(loggerMock.trace.args[0], [
            error,
            'Captured outbound error on behalf of the user.'
          ])
          t.same(tx.agent.errors.add.args[0], [tx, error])
          tx.agent.errors.add.restore()
          t.end()
        })
      }
    )
  })

  t.test('client:beforeConnect', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should add a segment for the undici.Client.connect', function (t) {
      helper.runInTransaction(agent, function () {
        const parentSegment = shim.createSegment('parent')
        shim.setActiveSegment(parentSegment)
        const connector = {}
        channels.beforeConnect.publish({ connector })
        t.ok(connector[SYMBOLS.SEGMENT])
        t.ok(connector[SYMBOLS.PARENT_SEGMENT])
        const segment = shim.getSegment()
        t.equal(segment.name, 'undici.Client.connect')
        t.end()
      })
    })
  })

  t.test('client:connected', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test('should end current segment and restore to parent', function (t) {
      helper.runInTransaction(agent, function () {
        const parentSegment = shim.createSegment('parent')
        const segment = shim.createSegment('active')
        shim.setActiveSegment(segment)
        const connector = {
          [SYMBOLS.PARENT_SEGMENT]: parentSegment,
          [SYMBOLS.SEGMENT]: segment
        }
        channels.connected.publish({ connector })
        t.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
        t.same(parentSegment, shim.getSegment(), 'parentSegment should now the active')
        t.end()
      })
    })
  })

  t.test('client:connectError', function (t) {
    t.autoend()
    t.afterEach(afterEach)

    t.test(
      'should end current segment and restore to parent and add error to active transaction',
      function (t) {
        helper.runInTransaction(agent, function (tx) {
          sandbox.stub(tx.agent.errors, 'add')
          const parentSegment = shim.createSegment('parent')
          const segment = shim.createSegment('active')
          shim.setActiveSegment(segment)
          const error = new Error('failed to create socket connection')
          const connector = {
            [SYMBOLS.PARENT_SEGMENT]: parentSegment,
            [SYMBOLS.SEGMENT]: segment
          }
          channels.connectError.publish({ connector, error })
          t.equal(segment.timer.state, 3, 'previous active segment timer should be stopped')
          t.same(parentSegment, shim.getSegment(), 'parentSegment should now the active')
          t.same(loggerMock.trace.args[0], [
            error,
            'Captured outbound error on behalf of the user.'
          ])
          t.same(tx.agent.errors.add.args[0], [tx, error])
          tx.agent.errors.add.restore()
          t.end()
        })
      }
    )
  })
})
