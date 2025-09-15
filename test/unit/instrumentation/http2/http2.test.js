/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const NAMES = require('../../../../lib/metrics/names')
const helper = require('../../../lib/agent_helper')
const Shim = require('../../../../lib/shim').Shim
const createHttp2ResponseServer = require('./fixtures/http2')

test.beforeEach(async (ctx) => {
  const { server, baseUrl, responses, host, port } = await createHttp2ResponseServer()
  ctx.nr = {}
  ctx.nr.initialize = require('../../../../lib/instrumentation/core/http2')
  ctx.nr.http2 = require('node:http2')
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.path = '/path'
  ctx.nr.protocol = 'http'
  ctx.nr.method = 'POST'
})

test.afterEach(async (ctx) => {
  if (ctx.nr?.server) { // not all tests use the actual server
    ctx.nr.server.destroy()
  }
})

test('built-in http2 module instrumentation', async (t) => {
  await t.test('should not cause bootstrapping to fail', async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr.agent = helper.loadMockedAgent()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('when passed an empty module', (t) => {
      const { agent, initialize } = t.nr
      assert.doesNotThrow(() => initialize(agent, {}, 'http2', new Shim(agent, 'http2')))
    })
  })

  await t.test('with outbound request', async (t) => {
    t.beforeEach(async (ctx) => {
      const agent = helper.loadMockedAgent()
      const http2 = require('node:http2')
      ctx.nr.agent = agent
      ctx.nr.initialize(agent, http2, 'http2', new Shim(agent, 'http2'))
      ctx.nr.http2 = http2
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should omit query parameters from path if attributes.enabled is false', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.attributes.enabled = false
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {})
        end()
      }
    })

    await t.test('should omit query parameters from path if high_security is true', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.high_security = true
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {
          procedure: 'GET',
          url: `http://${host}:${port}/asdf`
        })
        end()
      }
    })

    await t.test('should obfuscate url path if url_obfuscation regex pattern is set', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.url_obfuscation = {
        enabled: true,
        regex: {
          pattern: '.*',
          replacement: '/***'
        }
      }
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf/foo/bar/baz?test=123&test2=456',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(child.getAttributes(), {
          procedure: 'GET',
          url: `http://${host}:${port}/***`
        })
        end()
      }
    })

    await t.test('should strip query parameters from path in transaction trace segment', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      const name = NAMES.EXTERNAL.PREFIX + host + ':' + port + '/asdf'
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true6',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(child.name, name)
        end()
      }
    })

    await t.test('should save query parameters from path if attributes.enabled is true', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      agent.config.attributes.enabled = true
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/asdf?a=b&another=yourself&thing&grownup=true',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const [child] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.deepEqual(
          child.attributes.get(DESTINATIONS.SPAN_EVENT),
          {
            hostname: host,
            port,
            url: `http://${host}:${port}/asdf`,
            procedure: 'GET',
            'request.parameters.a': 'b',
            'request.parameters.another': 'yourself',
            'request.parameters.thing': true,
            'request.parameters.grownup': 'true'
          },
          'adds attributes to spans'
        )

        end()
      }
    })
  })
})

// Unlike http, http2 requests take place after an explicit connect is invoked
async function makeRequest(http2, params, cb) {
  const { protocol, host, port, path, method, headers, body = '' } = params
  const session = await http2.connect(`${protocol}://${host}:${port}`)
  const http2Headers = {
    ':authority': `${host}:${port}`,
    ':path': path,
    ':method': method
  }
  const combinedHeaders = { ...headers, ...http2Headers }
  const req = await session.request(combinedHeaders)

  req.on('error', function (err) {
    // If we aborted the request and the error is expected, then great.
    // http would send a connection reset, but http2 has different messaging.
    if (params.abort && err.code === 'ECONNRESET') {
      cb()
    } else {
      cb(err)
    }
  })

  req.setEncoding('utf8')
  let data = ''

  req.on('response', (headers) => {
    const responseHeaders = headers
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      session.close()
      cb(null, responseHeaders, data)
    })
  })

  if (params.abort) {
    setTimeout(function () {
      req.close()
    }, params.abort)
  }
  if (body) {
    return req.end(body)
  }
  req.end()
}
