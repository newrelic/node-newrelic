/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')

tap.test('Undici request tests', (t) => {
  t.autoend()

  let agent
  let undici

  t.before(() => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        undici_instrumentation: true
      }
    })

    undici = require('undici')
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.test('should not fail if request not in a transaction', async (t) => {
    const { statusCode } = await undici.request('https://httpbin.org', {
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from(`{"key":"value"}`)
    })

    t.equal(statusCode, 200)
    t.end()
  })

  t.test('should properly name segments', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request('https://httpbin.org', {
        path: '/post',
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      t.equal(statusCode, 200)

      metrics.assertSegments(tx.trace.root, ['External/httpbin.org/post'], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('should add attributes to external segment', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request('https://httpbin.org', {
        path: '/get?a=b&c=d',
        method: 'GET'
      })
      t.equal(statusCode, 200)
      const segment = metrics.findSegment(tx.trace.root, 'External/httpbin.org/get')
      const attrs = segment.getAttributes()
      t.equal(attrs.url, 'https://httpbin.org/get')
      t.equal(attrs.procedure, 'GET')
      const spanAttrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
      t.equal(spanAttrs['http.statusCode'], 200)
      t.equal(spanAttrs['http.statusText'], 'OK')
      t.equal(spanAttrs['request.parameters.a'], 'b')
      t.equal(spanAttrs['request.parameters.c'], 'd')

      tx.end()
      t.end()
    })
  })

  t.test('concurrent requests', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const req1 = undici.request('https://httpbin.org', {
        path: '/post',
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const req2 = undici.request('https://httpbin.org', {
        path: '/put',
        method: 'PUT',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const [{ statusCode }, { statusCode: statusCode2 }] = await Promise.all([req1, req2])
      t.equal(statusCode, 200)
      t.equal(statusCode2, 200)
      metrics.assertSegments(
        tx.trace.root,
        ['External/httpbin.org/post', 'External/httpbin.org/put'],
        { exact: false }
      )
      tx.end()
      t.end()
    })
  })

  t.test('invalid host', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      try {
        await undici.request('https://invalidurl', {
          path: '/foo',
          method: 'GET'
        })
      } catch (err) {
        t.match(err.message, /getaddrinfo.*invalidurl/)
        const segment = metrics.findSegment(tx.trace.root, 'External/invalidurl/foo')
        t.notOk(segment)
        tx.end()
        t.end()
      }
    })
  })

  t.test('should add errors to transaction when external segment exists', (t) => {
    const abortController = new AbortController()
    helper.runInTransaction(agent, async (tx) => {
      try {
        const req = undici.request('https://httpbin.org', {
          path: '/delay/1',
          signal: abortController.signal
        })
        setTimeout(() => {
          abortController.abort()
        }, 100)
        await req
      } catch (err) {
        metrics.assertSegments(tx.trace.root, ['External/httpbin.org/delay/1'], { exact: false })
        t.equal(tx.exceptions.length, 1)
        t.equal(tx.exceptions[0].error.message, 'Request aborted')
        tx.end()
        t.end()
      }
    })
  })

  t.test('400 status', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request('https://httpbin.org', {
        path: '/status/400',
        method: 'GET'
      })
      t.equal(statusCode, 400)
      metrics.assertSegments(tx.trace.root, ['External/httpbin.org/status/400'], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('fetch', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const res = await undici.fetch('https://httpbin.org')
      t.equal(res.status, 200)
      metrics.assertSegments(tx.trace.root, ['External/httpbin.org/'], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('stream', (t) => {
    const { Writable } = require('stream')
    helper.runInTransaction(agent, async (tx) => {
      await undici.stream(
        'https://httpbin.org',
        {
          path: '/get'
        },
        ({ statusCode }) => {
          t.equal(statusCode, 200)
          return new Writable({
            write(chunk, encoding, callback) {
              callback()
            }
          })
        }
      )
      metrics.assertSegments(tx.trace.root, ['External/httpbin.org/get'], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('pipeline', (t) => {
    const { pipeline, PassThrough, Readable, Writable } = require('stream')
    helper.runInTransaction(agent, async (tx) => {
      pipeline(
        new Readable({
          read() {
            this.push(Buffer.from('undici'))
            this.push(null)
          }
        }),
        undici.pipeline(
          'https://httpbin.org',
          {
            path: '/get'
          },
          ({ statusCode, body }) => {
            t.equal(statusCode, 200)
            return pipeline(body, new PassThrough(), () => {})
          }
        ),
        new Writable({
          write(chunk, _, callback) {
            callback()
          },
          final(callback) {
            callback()
          }
        }),
        (err) => {
          t.error(err)
          metrics.assertSegments(tx.trace.root, ['External/httpbin.org/get'], { exact: false })
          tx.end()
          t.end()
        }
      )
    })
  })
})
