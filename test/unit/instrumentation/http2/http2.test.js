/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
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

    await t.test(
      'when allow_all_headers is false, only collect allowed agent-specified headers',
      (t, end) => {
        const { agent, http2, port, host, protocol, method, path } = t.nr
        agent.config.allow_all_headers = false
        helper.runInTransaction(agent, function () {
          t.nr.transaction = agent.getTransaction()
          makeRequest(
            http2,
            {
              port,
              protocol,
              host,
              path,
              method,
              headers: {
                invalid: 'header',
                referer: 'valid-referer',
                'content-type': 'valid-type'
              },
              body: JSON.stringify({ foo: 'bar' })
            },
            finish
          )
        })

        function finish() {
          const { transaction } = t.nr
          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          assert.ok(!attributes['request.headers.invalid'])
          assert.equal(attributes['request.headers.referer'], 'valid-referer')
          assert.equal(attributes['request.headers.contentType'], 'valid-type')
          end()
        }
      }
    )

    await t.test(
      'when allow_all_headers is true, collect all headers not filtered by `exclude` rules',
      (t, end) => {
        const { agent, http2, port, host, protocol, method, path } = t.nr
        agent.config.allow_all_headers = true
        agent.config.attributes.exclude = ['request.headers.x*']
        // have to emit attributes getting updated so all filters get updated
        agent.config.emit('attributes.exclude')
        helper.runInTransaction(agent, function () {
          t.nr.transaction = agent.getTransaction()
          makeRequest(
            http2,
            {
              port,
              protocol,
              host,
              path,
              method,
              headers: {
                valid: 'header',
                referer: 'valid-referer',
                'content-type': 'valid-type',
                'X-filtered-out': 'invalid'
              },
              body: JSON.stringify({ bar: 'baz' })
            },
            finish
          )
        })

        function finish() {
          const { transaction } = t.nr
          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.ok(!attributes['request.headers.x-filtered-out'])
          assert.ok(!attributes['request.headers.xFilteredOut'])
          ;[attributes, spanAttributes].forEach((attrs) => {
            assert.equal(attrs['request.headers.valid'], 'header')
            assert.equal(attrs['request.headers.referer'], 'valid-referer')
            assert.equal(attrs['request.headers.contentType'], 'valid-type')
          })
          end()
        }
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is set, obfuscate segment url attributes',
      (t, end) => {
        const { agent, http2, host, port, protocol } = t.nr
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
              path: '/foo4/bar4',
              method: 'GET',
              headers: {
                valid: 'header',
                referer: 'valid-referer',
                'content-type': 'valid-type',
                'X-filtered-out': 'invalid'
              }
            },
            finish
          )
        })

        function finish() {
          const { transaction } = t.nr
          const segment = transaction.baseSegment
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          assert.equal(spanAttributes['request.uri'], '/***')

          end()
        }
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is set, obfuscate transaction url',
      (t, end) => {
        const { agent, http2, host, port, protocol } = t.nr
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
              host,
              protocol,
              path: '/foo4/bar4',
              method: 'GET'
            },
            finish
          )

          function finish() {
            const { transaction } = t.nr
            assert.equal(transaction.url, '/***')

            end()
          }
        })
      }
    )

    await t.test(
      'when url_obfuscation regex pattern is not set, url is only scrubbed',
      (t, end) => {
        const { agent, http2, host, port, protocol } = t.nr
        agent.config.url_obfuscation = { enabled: false }
        helper.runInTransaction(agent, function () {
          t.nr.transaction = agent.getTransaction()
          makeRequest(
            http2,
            {
              port,
              host,
              protocol,
              path: '/foo4/bar4?someParam=test',
              method: 'GET'
            },
            finish
          )
        })

        function finish() {
          const { transaction } = t.nr
          assert.equal(transaction.url, '/foo4/bar4')

          end()
        }
      }
    )

    await t.test('request.uri should not contain request params', (t, end) => {
      const { agent, http2, port, protocol, host } = t.nr
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            protocol,
            host,
            path: '/foo5/bar5?region=here&auth=secretString',
            method: 'GET'
          },
          finish
        )
      })

      function finish() {
        const { transaction } = t.nr
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.equal(spanAttributes['request.uri'], '/foo5/bar5')

        end()
      }
    })

    await t.test('successful request', (t, end) => {
      const { agent, http2, host, port, path, protocol } = t.nr
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'
      const userAgent = 'Palm680/RC1'
      helper.runInTransaction(agent, function () {
        t.nr.transaction = agent.getTransaction()
        makeRequest(
          http2,
          {
            port,
            host,
            path,
            protocol,
            method: 'GET',
            headers: {
              referer: refererUrl,
              'User-Agent': userAgent
            }
          },
          finish
        )
      })

      function finish(err, headers) {
        assert.ifError(err)
        const { transaction } = t.nr
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        const segment = transaction.baseSegment
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        const statusCode = headers[':status']

        assert.equal(statusCode, 200, 'response status code')
        ;[attributes, spanAttributes].forEach((attrs) => {
          assert.equal(
            attrs['request.headers.referer'],
            'https://www.google.com/search/cats',
            'headers.referer'
          )
          assert.equal(attrs['response.headers.status'], '200')
          assert.equal(attrs['request.headers.userAgent'], userAgent)
        })

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
