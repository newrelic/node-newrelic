/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const http = require('http')
const test = require('tap').test
const semver = require('semver')
const { version: pkgVersion } = require('express/package')

let express
let agent
let app

runTests({
  express_segments: false
})

runTests({
  express_segments: true
})

function runTests(flags) {
  test('transaction name with single route', function (t) {
    setup(t)

    app.get('/path1', function (req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('transaction name with no matched routes', function (t) {
    setup(t)

    app.get('/path1', function (req, res) {
      res.end()
    })

    const endpoint = '/asdf'

    agent.on('transactionFinished', function (transaction) {
      t.equal(
        transaction.name,
        'WebTransaction/Expressjs/GET/(not found)',
        'transaction has expected name'
      )
      t.end()
    })
    const server = app.listen(function () {
      makeRequest(this, endpoint)
    })
    t.teardown(() => {
      server.close()
    })
  })

  test('transaction name with route that has multiple handlers', function (t) {
    setup(t)

    app.get(
      '/path1',
      function (req, res, next) {
        next()
      },
      function (req, res) {
        res.end()
      }
    )

    runTest(t, '/path1', '/path1')
  })

  test('transaction name with router middleware', function (t) {
    setup(t)

    const router = new express.Router()
    router.get('/path1', function (req, res) {
      res.end()
    })

    app.use(router)

    runTest(t, '/path1', '/path1')
  })

  test('transaction name with middleware function', function (t) {
    setup(t)

    app.use('/path1', function (req, res, next) {
      next()
    })

    app.get('/path1', function (req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('transaction name with shared middleware function', function (t) {
    setup(t)

    app.use(['/path1', '/path2'], function (req, res, next) {
      next()
    })

    app.get('/path1', function (req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('transaction name when ending in shared middleware', function (t) {
    setup(t)

    app.use(['/path1', '/path2'], function (req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1,/path2')
  })

  test('transaction name with subapp middleware', function (t) {
    setup(t)

    const subapp = express()

    subapp.get('/path1', function middleware(req, res) {
      res.end()
    })

    app.use(subapp)

    runTest(t, '/path1', '/path1')
  })

  test('transaction name with subrouter', function (t) {
    setup(t)

    const router = new express.Router()

    router.get('/path1', function (req, res) {
      res.end()
    })

    app.use('/api', router)

    runTest(t, '/api/path1', '/api/path1')
  })

  test('multiple route handlers with the same name do not duplicate transaction name', function (t) {
    setup(t)

    app.get('/path1', function (req, res, next) {
      next()
    })

    app.get('/path1', function (req, res) {
      res.end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('responding from middleware', function (t) {
    setup(t)

    app.use('/test', function (req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test')
  })

  test('responding from middleware with parameter', function (t) {
    setup(t)

    app.use('/test', function (req, res, next) {
      res.send('ok')
      next()
    })

    runTest(t, '/test/param', '/test')
  })

  test('with error', function (t) {
    setup(t)

    app.get('/path1', function (req, res, next) {
      next(new Error('some error'))
    })

    app.use(function (err, req, res) {
      return res.status(500).end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('with error and path-specific error handler', function (t) {
    setup(t)

    app.get('/path1', function () {
      throw new Error('some error')
    })

    app.use('/path1', function(err, req, res, next) { // eslint-disable-line
      res.status(500).end()
    })

    runTest(t, '/path1', '/path1')
  })

  test('when router error is handled outside of the router', function (t) {
    setup(t)

    const router = new express.Router()

    router.get('/path1', function (req, res, next) {
      next(new Error('some error'))
    })

    app.use('/router1', router)

    // eslint-disable-next-line no-unused-vars
    app.use(function (err, req, res, next) {
      return res.status(500).end()
    })

    runTest(t, '/router1/path1', '/router1/path1')
  })

  test('when using a route variable', function (t) {
    setup(t)

    app.get('/:foo/:bar', function (req, res) {
      res.end()
    })

    runTest(t, '/foo/bar', '/:foo/:bar')
  })

  test('when using a string pattern in path', function (t) {
    setup(t)

    app.get('/ab?cd', function (req, res) {
      res.end()
    })

    runTest(t, '/abcd', '/ab?cd')
  })

  test('when using a regular expression in path', function (t) {
    setup(t)

    app.get(/a/, function (req, res) {
      res.end()
    })

    runTest(t, '/abcd', '/a/')
  })

  test('when using router with a route variable', function (t) {
    setup(t)

    const router = express.Router() // eslint-disable-line new-cap

    router.get('/:var2/path1', function (req, res) {
      res.end()
    })

    app.use('/:var1', router)

    runTest(t, '/foo/bar/path1', '/:var1/:var2/path1')
  })

  test('when mounting a subapp using a variable', function (t) {
    setup(t)

    const subapp = express()
    subapp.get('/:var2/path1', function (req, res) {
      res.end()
    })

    app.use('/:var1', subapp)

    runTest(t, '/foo/bar/path1', '/:var1/:var2/path1')
  })

  test('using two routers', function (t) {
    setup(t)

    const router1 = express.Router() // eslint-disable-line new-cap
    const router2 = express.Router() // eslint-disable-line new-cap

    app.use('/:router1', router1)
    router1.use('/:router2', router2)

    router2.get('/path1', function (req, res) {
      res.end()
    })

    runTest(t, '/router1/router2/path1', '/:router1/:router2/path1')
  })

  test('transactions running in parallel should be recorded correctly', function (t) {
    setup(t)
    const router1 = express.Router() // eslint-disable-line new-cap
    const router2 = express.Router() // eslint-disable-line new-cap

    app.use('/:router1', router1)
    router1.use('/:router2', router2)

    router2.get('/path1', function (req, res) {
      setTimeout(function () {
        res.end()
      }, 0)
    })

    const numTests = 4
    const runner = makeMultiRunner(
      t,
      '/router1/router2/path1',
      '/:router1/:router2/path1',
      numTests
    )
    app.listen(function () {
      t.teardown(() => {
        this.close()
      })
      for (let i = 0; i < numTests; i++) {
        runner(this)
      }
    })
  })

  test('names transaction when request is aborted', function (t) {
    t.plan(4)
    setup(t)

    let request = null

    app.get('/test', function (req, res, next) {
      t.comment('middleware')
      t.ok(agent.getTransaction(), 'transaction exists')

      // generate error after client has aborted
      request.abort()
      setTimeout(function () {
        t.comment('timed out')
        t.ok(agent.getTransaction() == null, 'transaction has already ended')
        next(new Error('some error'))
      }, 100)
    })

    // eslint-disable-next-line no-unused-vars
    app.use(function (error, req, res, next) {
      t.comment('errorware')
      t.ok(agent.getTransaction() == null, 'no active transaction when responding')
      res.end()
    })

    const server = app.listen(function () {
      t.comment('making request')
      const port = this.address().port
      request = http.request(
        {
          hostname: 'localhost',
          port: port,
          path: '/test'
        },
        function () {}
      )
      request.end()

      // add error handler, otherwise aborting will cause an exception
      request.on('error', function (err) {
        t.comment('request errored: ' + err)
      })
      request.on('abort', function () {
        t.comment('request aborted')
      })
    })

    agent.on('transactionFinished', function (tx) {
      t.equal(tx.name, 'WebTransaction/Expressjs/GET//test')
    })

    t.teardown(() => {
      server.close()
    })
  })

  test('Express transaction names are unaffected by errorware', function (t) {
    t.plan(1)
    setup(t)

    agent.on('transactionFinished', function (tx) {
      const expected = 'WebTransaction/Expressjs/GET//test'
      t.equal(tx.trace.root.children[0].name, expected)
    })

    app.use('/test', function () {
      throw new Error('endpoint error')
    })

    // eslint-disable-next-line no-unused-vars
    app.use('/test', function (err, req, res, next) {
      res.send(err.message)
    })

    const server = app.listen(function () {
      http.request({ port: this.address().port, path: '/test' }).end()
    })

    t.teardown(function () {
      server.close()
    })
  })

  test('when next is called after transaction state loss', function (t) {
    // Uninstrumented work queue. This must be set up before the agent is loaded
    // so that no transaction state is maintained.
    const tasks = []
    const interval = setInterval(function () {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    setup(t)
    t.plan(3)

    let transactionsFinished = 0
    const transactionNames = [
      'WebTransaction/Expressjs/GET//bar',
      'WebTransaction/Expressjs/GET//foo'
    ]
    agent.on('transactionFinished', function (tx) {
      t.equal(
        tx.name,
        transactionNames[transactionsFinished++],
        'should have expected name ' + transactionsFinished
      )
    })

    app.use('/foo', function (req, res, next) {
      setTimeout(function () {
        tasks.push(next)
      }, 5)
    })

    app.get('/foo', function (req, res) {
      setTimeout(function () {
        res.send('foo done\n')
      }, 500)
    })

    app.get('/bar', function (req, res) {
      res.send('bar done\n')
    })

    const server = app.listen(function () {
      const port = this.address().port

      // Send first request to `/foo` which is slow and uses the work queue.
      http.get({ port: port, path: '/foo' }, function (res) {
        res.resume()
        res.on('end', function () {
          t.equal(transactionsFinished, 2, 'should have two transactions done')
          t.end()
        })
      })

      // Send the second request after a short wait `/bar` which is fast and
      // does not use the work queue.
      setTimeout(function () {
        http.get({ port: port, path: '/bar' }, function (res) {
          res.resume()
        })
      }, 100)
    })
    t.teardown(function () {
      server.close()
      clearInterval(interval)
    })
  })

  // express did not add array based middleware registration
  // without path until 4.9.2
  // https://github.com/expressjs/express/blob/master/History.md#492--2014-09-17
  if (semver.satisfies(pkgVersion, '>=4.9.2')) {
    test('transaction name with array of middleware with unspecified mount path', (t) => {
      setup(t)

      function mid1(req, res, next) {
        t.pass('mid1 is executed')
        next()
      }

      function mid2(req, res, next) {
        t.pass('mid2 is executed')
        next()
      }

      app.use([mid1, mid2])

      app.get('/path1', (req, res) => {
        res.end()
      })

      runTest(t, '/path1', '/path1')
    })

    test('transaction name when ending in array of unmounted middleware', (t) => {
      setup(t)

      function mid1(req, res, next) {
        t.pass('mid1 is executed')
        next()
      }

      function mid2(req, res) {
        t.pass('mid2 is executed')
        res.end()
      }

      app.use([mid1, mid2])

      app.use(mid1)

      runTest(t, '/path1', '/')
    })
  }

  function setup(t) {
    agent = helper.instrumentMockedAgent(flags)

    express = require('express')
    app = express()
    t.teardown(() => {
      helper.unloadAgent(agent)
    })
  }

  function makeMultiRunner(t, endpoint, expectedName, numTests) {
    let done = 0
    const seen = new Set()
    if (!expectedName) {
      expectedName = endpoint
    }
    agent.on('transactionFinished', function (transaction) {
      t.notOk(seen.has(transaction), 'should never see the finishing transaction twice')
      seen.add(transaction)
      t.equal(
        transaction.name,
        'WebTransaction/Expressjs/GET/' + expectedName,
        'transaction has expected name'
      )
      transaction.end()
      if (++done === numTests) {
        done = 0
        t.end()
      }
    })
    return function runMany(server) {
      makeRequest(server, endpoint)
    }
  }

  function runTest(t, endpoint, expectedName) {
    if (!expectedName) {
      expectedName = endpoint
    }
    agent.on('transactionFinished', function (transaction) {
      t.equal(
        transaction.name,
        'WebTransaction/Expressjs/GET/' + expectedName,
        'transaction has expected name'
      )
      t.end()
    })
    const server = app.listen(function () {
      makeRequest(this, endpoint)
    })
    t.teardown(() => {
      server.close()
    })
  }

  function makeRequest(server, path, callback) {
    const port = server.address().port
    http.request({ port: port, path: path }, callback).end()
  }
}
