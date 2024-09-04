/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const http = require('http')
const helper = require('../../../lib/agent_helper')
const PORT = 0
const THRESHOLD = 200

/**
 * This test file has been setup to run serial / not in parallel with other files.
 * These tests attempt to verify a reasonable threshold for queue time.
 * That can be easily thrwarted during a parallel run which can double time
 * for these to execute.
 */
test('built-in http queueTime', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.testDate = Date.now()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('header should allow t=${time} style headers', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-request-start': 't=' + (testDate - 10)
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })

  await t.test('bad header should log a warning', (t, end) => {
    const { agent } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.equal(transTime, 0, 'queueTime is not added')
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-request-start': 'alskdjf'
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })

  await t.test('x-request should verify milliseconds', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-request-start': testDate - 10
        }
      }
      http.get(opts, () => {
        server.close()
        return end()
      })
    })
  })

  await t.test('x-queue should verify milliseconds', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-queue-start': testDate - 10
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })

  await t.test('x-request should verify microseconds', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-request-start': (testDate - 10) * 1e3
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })

  await t.test('x-queue should verify nanoseconds', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-queue-start': (testDate - 10) * 1e6
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })

  await t.test('x-request should verify seconds', (t, end) => {
    const { agent, testDate } = t.nr
    const server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert.ok(transTime > 0, 'must be positive')
      assert.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
      response.end()
    })

    server.listen(PORT, () => {
      const port = server.address().port
      const opts = {
        host: 'localhost',
        port: port,
        headers: {
          'x-request-start': (testDate - 10) / 1e3
        }
      }
      http.get(opts, () => {
        server.close(end)
      })
    })
  })
})
