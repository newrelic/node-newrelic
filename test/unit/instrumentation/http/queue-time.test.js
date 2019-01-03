'use strict'

const assert = require('assert')
const http = require('http')
const helper = require('../../../lib/agent_helper')

describe('built-in http queueTime', () => {
  let agent = null
  let testDate = null
  let PORT = null
  let THRESHOLD = null

  before(() => {
    agent = helper.instrumentMockedAgent()

    testDate = Date.now()
    PORT = 0
    THRESHOLD = 200
  })

  after(() => {
    helper.unloadAgent(agent)
  })

  it('header should allow t=${time} style headers', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })

  it('bad header should log a warning', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
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
        server.close()
        return done()
      })
    })
  })

  it('x-request should verify milliseconds', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })

  it('x-queue should verify milliseconds', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })

  it('x-request should verify microseconds', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })

  it('x-queue should verify nanoseconds', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })

  it('x-request should verify seconds', (done) => {
    let server = null

    server = http.createServer(function cb_createServer(request, response) {
      const transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(
        transTime < THRESHOLD,
        `should be less than ${THRESHOLD}ms (${transTime}ms)`
      )
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
        return done()
      })
    })
  })
})
