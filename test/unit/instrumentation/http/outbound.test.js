/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const events = require('node:events')

const helper = require('../../../lib/agent_helper')
const instrumentOutbound = require('../../../../lib/instrumentation/core/http-outbound')
const symbols = require('../../../../lib/symbols')

const { DESTINATIONS } = require('../../../../lib/config/attribute-filter')
const NAMES = require('../../../../lib/metrics/names')
const HOSTNAME = 'localhost'
const PORT = 8890

test('instrumentOutbound', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should omit query parameters from path if attributes.enabled is false',
    (t, end) => {
      const { agent } = t.nr
      agent.config.attributes.enabled = false
      const req = new events.EventEmitter()
      helper.runInTransaction(agent, function (transaction) {
        instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {})

        function makeFakeRequest() {
          req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
          return req
        }
        end()
      })
    }
  )

  await t.test('should omit query parameters from path if high_security is true', (t, end) => {
    const { agent } = t.nr
    agent.config.high_security = true
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/asdf`
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should obfuscate url path if url_obfuscation regex pattern is set', (t, end) => {
    const { agent } = t.nr
    agent.config.url_obfuscation = {
      enabled: true,
      regex: {
        pattern: '.*',
        replacement: '/***'
      }
    }
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(child.getAttributes(), {
        procedure: 'GET',
        url: `http://${HOSTNAME}:${PORT}/***`
      })

      function makeFakeRequest() {
        req.path = '/asdf/foo/bar/baz?test=123&test2=456'
        return req
      }
      end()
    })
  })

  await t.test('should strip query parameters from path in transaction trace segment', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      const path = '/asdf'
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path

      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should save query parameters from path if attributes.enabled is true', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      agent.config.attributes.enabled = true
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.deepEqual(
        child.attributes.get(DESTINATIONS.SPAN_EVENT),
        {
          hostname: HOSTNAME,
          port: PORT,
          url: `http://${HOSTNAME}:${PORT}/asdf`,
          procedure: 'GET',
          'request.parameters.a': 'b',
          'request.parameters.another': 'yourself',
          'request.parameters.thing': true,
          'request.parameters.grownup': 'true'
        },
        'adds attributes to spans'
      )

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
      end()
    })
  })

  await t.test('should accept a simple path with no parameters', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    const path = '/newrelic'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
      end()
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  await t.test('should purge trailing slash', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    const path = '/newrelic/'
    helper.runInTransaction(agent, function (transaction) {
      const name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path = path
      instrumentOutbound(agent, { host: HOSTNAME, port: PORT }, makeFakeRequest)
      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.equal(child.name, name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is undefined', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is null', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: null, port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if hostname is an empty string', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: '', port: PORT }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not throw if port is undefined', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      let req2 = null
      assert.doesNotThrow(() => {
        req2 = instrumentOutbound(agent, { host: 'hostname' }, makeFakeRequest)
      })

      assert.equal(req2, req)
      assert.ok(!req2[symbols.transactionInfo])
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
    end()
  })

  await t.test('should not crash when req.headers is null', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      const path = '/asdf'

      instrumentOutbound(agent, { headers: null, host: HOSTNAME, port: PORT }, makeFakeRequest)

      function makeFakeRequest(opts) {
        assert.ok(opts.headers, 'should assign headers when null')
        assert.ok(opts.headers.traceparent, 'traceparent should exist')
        req.path = path
        return req
      }
    })
    end()
  })

  await t.test('should prioritize using href', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      const path = '/someother/path'
      const href = `http://${HOSTNAME}:${PORT}/someother/path/more?query=string`

      instrumentOutbound(agent, { href, host: HOSTNAME, port: PORT }, makeFakeRequest)

      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.ok(child.name.includes('someother/path/more'), 'should use href over request.path')

      function makeFakeRequest(opts) {
        req.path = path
        return req
      }
      end()
    })
  })

  await t.test('should construct url from protocol, host header and path when path is not a substring of href', (t, end) => {
    const { agent } = t.nr
    const req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      const path = '/fallback/path'
      const href = 'not-a-valid-url'

      instrumentOutbound(agent, { href, host: HOSTNAME, port: PORT }, makeFakeRequest)

      const [child] = transaction.trace.getChildren(transaction.trace.root.id)
      assert.ok(child.name.includes(path), 'should use request.path when href is invalid')

      function makeFakeRequest(opts) {
        req.path = path
        return req
      }
      end()
    })
  })
})
