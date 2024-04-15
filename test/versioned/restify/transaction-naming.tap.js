/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const tap = require('tap')
const semver = require('semver')
const { runTest } = require('./common')

tap.test('Restify transaction naming', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  let restifyPkg = null
  let server = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()

    restify = require('restify')
    restifyPkg = require('restify/package.json')
    server = restify.createServer()
  })

  t.afterEach(() => {
    return new Promise((resolve) => {
      helper.unloadAgent(agent)
      if (server) {
        server.close(resolve)
      } else {
        resolve()
      }
    })
  })

  t.test('transaction name with single route', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('transaction name with async response middleware', (t) => {
    t.plan(1)

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.send({
        patientId: 5,
        entries: ['hi', 'bye', 'example'],
        total: 3
      })
      next()
    })

    runTest({
      agent,
      server,
      t,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })
  })

  t.test('transaction name with async response middleware (res.json)', (t) => {
    t.plan(1)

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.json({
        patientId: 5,
        entries: ['hi', 'bye', 'example'],
        total: 3
      })
      next()
    })

    runTest({
      agent,
      server,
      t,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })
  })

  if (semver.satisfies(restifyPkg.version, '>=5')) {
    t.test('transaction name with async response middleware (res.sendRaw)', (t) => {
      t.plan(1)

      // restify v5 added the plugins object
      if (restify.plugins && restify.plugins.gzipResponse) {
        server.use(restify.plugins.gzipResponse())
      } else {
        server.use(restify.gzipResponse())
      }

      server.get('/path1', (req, res, next) => {
        res.sendRaw(
          JSON.stringify({
            patientId: 5,
            entries: ['hi', 'bye', 'example'],
            total: 3
          })
        )
        next()
      })

      runTest({
        agent,
        server,
        t,
        endpoint: '/path1',
        expectedName: 'GET//path1',
        requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
      })
    })
  }

  t.test('transaction name with async response middleware (res.redirect)', (t) => {
    t.plan(1)

    // restify v5 added the plugins object
    if (restify.plugins && restify.plugins.gzipResponse) {
      server.use(restify.plugins.gzipResponse())
    } else {
      server.use(restify.gzipResponse())
    }

    server.get('/path1', (req, res, next) => {
      res.redirect('http://google.com', next)
    })

    runTest({
      agent,
      server,
      t,
      endpoint: '/path1',
      expectedName: 'GET//path1',
      requestOpts: { headers: { 'Accept-Encoding': 'gzip' } }
    })
  })

  t.test('transaction name with no matched routes', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      t.fail('should not enter different endpoint')
      res.send()
      next()
    })

    runTest({
      agent,
      server,
      t,
      endpoint: '/foobar',
      prefix: 'Nodejs',
      expectedName: 'GET/(not found)'
    })
  })

  t.test('transaction name contains trailing slash', (t) => {
    t.plan(2)

    server.get('/path/', (req, res, next) => {
      t.pass('should enter route')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/path/', expectedName: 'GET//path/' })
  })

  t.test('transaction name does not contain trailing slash', (t) => {
    t.plan(2)

    server.get('/path', (req, res, next) => {
      t.pass('should enter route')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/path', expectedName: 'GET//path' })
  })

  t.test('transaction name with route that has multiple handlers', (t) => {
    t.plan(3)

    server.get(
      '/path1',
      (req, res, next) => {
        t.pass('should enter first middleware')
        next()
      },
      (req, res, next) => {
        t.pass('should enter second middleware')
        res.send()
        next()
      }
    )

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('transaction name with middleware', (t) => {
    t.plan(3)

    server.use((req, res, next) => {
      t.pass('should enter `use` middleware')
      next()
    })
    server.get('/path1', (req, res, next) => {
      t.pass('should enter route handler')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('with error', (t) => {
    t.plan(1)

    const errors = require('restify-errors')

    server.get('/path1', (req, res, next) => {
      next(new errors.InternalServerError('foobar'))
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('with error while out of context', (t) => {
    t.plan(1)

    const errors = require('restify-errors')

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        next(new errors.InternalServerError('foobar'))
      })
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('when using a route variable', (t) => {
    t.plan(2)

    server.get('/foo/:bar', (req, res, next) => {
      t.equal(req.params.bar, 'fizz', 'should pass through params')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/foo/fizz', expectedName: 'GET//foo/:bar' })
  })

  t.test('when using a regular expression in path', (t) => {
    t.plan(2)

    server.get('/foo/*', (req, res, next) => {
      t.equal(req.params['*'], 'bar', 'should pass through captured param')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/foo/bar', expectedName: 'GET//foo/*' })
  })

  t.test('when next is called after transaction state loss', (t) => {
    t.plan(5)

    server.use((req, res, next) => {
      t.ok(agent.getTransaction(), 'should have transaction at start')
      req.testTx = agent.getTransaction()

      helper.runOutOfContext(() => {
        t.notOk(agent.getTransaction(), 'should lose transaction before next')
        next()
      })
    })

    server.get('/path1', (req, res, next) => {
      const tx = agent.getTransaction()
      t.ok(tx, 'should re-instate transaction in next middleware')
      t.equal(tx && tx.id, req.testTx.id, 'should reinstate correct transaction')
      res.send()
      next()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('responding after transaction state loss', (t) => {
    t.plan(2)

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        t.notOk(agent.getTransaction(), 'should have no transaction')
        res.send()
        next()
      })
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('responding with just a status code', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      res.send(299)
      next()
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })

  t.test('responding with just a status code after state loss', (t) => {
    t.plan(1)

    server.get('/path1', (req, res, next) => {
      helper.runOutOfContext(() => {
        res.send(299)
        next()
      })
    })

    runTest({ agent, server, t, endpoint: '/path1', expectedName: 'GET//path1' })
  })
})
