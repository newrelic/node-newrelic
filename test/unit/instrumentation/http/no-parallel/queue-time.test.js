/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const http = require('http')
const helper = require('../../../../lib/agent_helper')

/**
 * This test file has been setup to run serial / not in parallel with other files.
 * These tests attempt to verify a reasonable threshold for queue time.
 * That can be easily thrwarted during a parallel run which can double time
 * for these to execute.
 */
tap.test('built-in http queueTime', (t) => {
  let agent = null
  let testDate = null
  let PORT = null
  let THRESHOLD = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()

    testDate = Date.now()
    PORT = 0
    THRESHOLD = 200
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('header should allow t=${time} style headers', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        server.close()
        return t.end()
      })
    })
  })

  t.test('bad header should log a warning', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.equal(transTime, 0, 'queueTime is not added')
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
        server.close()
        return t.end()
      })
    })
  })

  t.test('x-request should verify milliseconds', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        return t.end()
      })
    })
  })

  t.test('x-queue should verify milliseconds', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        server.close()
        return t.end()
      })
    })
  })

  t.test('x-request should verify microseconds', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        server.close()
        return t.end()
      })
    })
  })

  t.test('x-queue should verify nanoseconds', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        server.close()
        return t.end()
      })
    })
  })

  t.test('x-request should verify seconds', (t) => {
    let server = null

    server = http.createServer(function createServerCb(request, response) {
      const transTime = agent.getTransaction().queueTime
      t.ok(transTime > 0, 'must be positive')
      t.ok(transTime < THRESHOLD, `should be less than ${THRESHOLD}ms (${transTime}ms)`)
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
        server.close()
        return t.end()
      })
    })
  })
  t.end()
})
