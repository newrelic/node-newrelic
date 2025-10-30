/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Make express quiet.
process.env.NODE_ENV = 'test'

const assert = require('node:assert')
const http = require('http')
const test = require('node:test')
const semver = require('semver')
const { version: pkgVersion } = require('express/package')
const { makeRequest, setup, teardown } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('transaction name with single route', function (t, end) {
  const { app } = t.nr

  app.get('/path1', function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('transaction name with no matched routes', function (t, end) {
  const { agent, app, isExpress5, port } = t.nr

  app.get('/path1', function (req, res) {
    res.end()
  })

  const endpoint = '/asdf'

  const txPrefix = isExpress5 ? 'WebTransaction/Nodejs' : 'WebTransaction/Expressjs'
  agent.on('transactionFinished', function (transaction) {
    assert.equal(transaction.name, `${txPrefix}/GET/(not found)`, 'transaction has expected name')
    end()
  })

  makeRequest(port, endpoint)
})

test('transaction name with route that has multiple handlers', function (t, end) {
  const { app } = t.nr

  app.get(
    '/path1',
    function (req, res, next) {
      next()
    },
    function (req, res) {
      res.end()
    }
  )

  runTest({ t, end, endpoint: '/path1', expectedName: '/path1' })
})

test('transaction name with router middleware', function (t, end) {
  const { app, express } = t.nr

  const router = new express.Router()
  router.get('/path1', function (req, res) {
    res.end()
  })

  app.use(router)

  runTest({ t, end, endpoint: '/path1' })
})

test('transaction name with middleware function', function (t, end) {
  const { app } = t.nr

  app.use('/path1', function (req, res, next) {
    next()
  })

  app.get('/path1', function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('transaction name with shared middleware function', function (t, end) {
  const { app } = t.nr

  app.use(['/path1', '/path2'], function (req, res, next) {
    next()
  })

  app.get('/path1', function secondRoute(req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('transaction name when ending in shared middleware', function (t, end) {
  const { app } = t.nr

  app.use(['/path1', '/path2'], function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/path1', expectedName: '/path1,/path2' })
})

test('transaction name with subapp middleware', function (t, end) {
  const { app, express } = t.nr

  const subapp = express()

  subapp.get('/path1', function middleware(req, res) {
    res.end()
  })

  app.use(subapp)

  runTest({ t, end, endpoint: '/path1' })
})

test('transaction name with subrouter', function (t, end) {
  const { app, express } = t.nr

  const router = new express.Router()

  router.get('/path1', function (req, res) {
    res.end()
  })

  app.use('/api', router)

  runTest({ t, end, endpoint: '/api/path1' })
})

test('multiple route handlers with the same name do not duplicate transaction name', function (t, end) {
  const { app } = t.nr

  app.get('/path1', function (req, res, next) {
    next()
  })

  app.get('/path1', function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('responding from middleware', function (t, end) {
  const { app } = t.nr

  app.use('/test', function (req, res, next) {
    res.send('ok')
    next()
  })

  runTest({ t, end, endpoint: '/test' })
})

test('responding from middleware with parameter', function (t, end) {
  const { app } = t.nr

  app.use('/test', function (req, res, next) {
    res.send('ok')
    next()
  })

  runTest({ t, end, endpoint: '/test/param', expectedName: '/test' })
})

test('with error', function (t, end) {
  const { app } = t.nr

  app.get('/path1', function (req, res, next) {
    next(new Error('some error'))
  })

  app.use(function (_, req, res) {
    return res.status(500).end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('with error and path-specific error handler', function (t, end) {
  const { app } = t.nr

  app.get('/path1', function () {
    throw new Error('some error')
  })

  app.use('/path1', function(err, req, res, next) { // eslint-disable-line
    res.status(500).end()
  })

  runTest({ t, end, endpoint: '/path1' })
})

test('when router error is handled outside of the router', function (t, end) {
  const { app, express } = t.nr

  const router = new express.Router()

  router.get('/path1', function (req, res, next) {
    next(new Error('some error'))
  })

  app.use('/router1', router)

  app.use(function (_, req, res, next) {
    return res.status(500).end()
  })

  runTest({ t, end, endpoint: '/router1/path1' })
})

test('when using a route variable', function (t, end) {
  const { app } = t.nr

  app.get('/:foo/:bar', function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/foo/bar', expectedName: '/:foo/:bar' })
})

test('when using a string pattern in path', function (t, end) {
  const { app, isExpress5 } = t.nr

  const path = isExpress5 ? /ab?cd/ : '/ab?cd'

  app.get(path, function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/abcd', expectedName: '/ab?cd' })
})

test('when using a regular expression in path', function (t, end) {
  const { app } = t.nr

  app.get(/a/, function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/abcd', expectedName: '/a' })
})

test('when using router with a route variable', function (t, end) {
  const { app, express } = t.nr

  const router = express.Router()

  router.get('/:var2/path1', function (req, res) {
    res.end()
  })

  app.use('/:var1', router)

  runTest({ t, end, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
})

test('when mounting a subapp using a variable', function (t, end) {
  const { app, express } = t.nr

  const subapp = express()
  subapp.get('/:var2/path1', function (req, res) {
    res.end()
  })

  app.use('/:var1', subapp)

  runTest({ t, end, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
})

test('using two routers', function (t, end) {
  const { app, express } = t.nr

  const router1 = express.Router()
  const router2 = express.Router()

  app.use('/:router1', router1)
  router1.use('/:router2', router2)

  router2.get('/path1', function (req, res) {
    res.end()
  })

  runTest({ t, end, endpoint: '/router1/router2/path1', expectedName: '/:router1/:router2/path1' })
})

test('transactions running in parallel should be recorded correctly', function (t, end) {
  const { app, express } = t.nr
  const router1 = express.Router()
  const router2 = express.Router()

  app.use('/:router1', router1)
  router1.use('/:router2', router2)

  router2.get('/path1', function (req, res) {
    setTimeout(function () {
      res.end()
    }, 0)
  })

  const numTests = 4
  const runner = makeMultiRunner({
    t,
    end,
    endpoint: '/router1/router2/path1',
    expectedName: '/:router1/:router2/path1',
    numTests
  })

  for (let i = 0; i < numTests; i++) {
    runner()
  }
})

test('names transaction when request is aborted', async function (t) {
  const plan = tsplan(t, { plan: 6 })

  const { agent, app, port } = t.nr

  let request = null

  app.get('/test', function (req, res, next) {
    plan.ok(agent.getTransaction(), 'transaction exists')

    // generate error after client has aborted
    request.abort()
    setTimeout(function () {
      plan.ok(agent.getTransaction() == null, 'transaction has already ended')
      next(new Error('some error'))
    }, 100)
  })

  app.use(function (error, req, res, next) {
    plan.equal(error.message, 'some error')
    plan.ok(agent.getTransaction() == null, 'no active transaction when responding')
    res.end()
  })

  request = http.request(
    {
      hostname: 'localhost',
      port,
      path: '/test'
    },
    function () {}
  )
  request.end()

  // add error handler, otherwise aborting will cause an exception
  request.on('error', function (err) {
    plan.equal(err.code, 'ECONNRESET')
  })

  agent.on('transactionFinished', function (tx) {
    plan.equal(tx.name, 'WebTransaction/Expressjs/GET//test')
  })
  await plan.completed
})

test('Express transaction names are unaffected by errorware', async function (t) {
  const plan = tsplan(t, { plan: 1 })

  const { agent, app, port } = t.nr

  agent.on('transactionFinished', function (tx) {
    const expected = 'WebTransaction/Expressjs/GET//test'
    const [baseSegment] = tx.trace.getChildren(tx.trace.root.id)
    plan.equal(baseSegment.name, expected)
  })

  app.use('/test', function () {
    throw new Error('endpoint error')
  })

  app.use('/test', function (err, req, res, next) {
    res.send(err.message)
  })

  http.request({ port, path: '/test' }).end()
  await plan.completed
})

test('when next is called after transaction state loss', async function (t) {
  // Uninstrumented work queue. This must be set up before the agent is loaded
  // so that no transaction state is maintained.
  const tasks = []
  const interval = setInterval(function () {
    if (tasks.length) {
      tasks.pop()()
    }
  }, 10)

  t.after(function () {
    clearInterval(interval)
  })

  const { agent, app, port } = t.nr
  const plan = tsplan(t, { plan: 3 })

  let transactionsFinished = 0
  const transactionNames = [
    'WebTransaction/Expressjs/GET//bar',
    'WebTransaction/Expressjs/GET//foo'
  ]
  agent.on('transactionFinished', function (tx) {
    plan.equal(
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

  // Send first request to `/foo` which is slow and uses the work queue.
  http.get({ port, path: '/foo' }, function (res) {
    res.resume()
    res.on('end', function () {
      plan.equal(transactionsFinished, 2, 'should have two transactions done')
    })
  })

  // Send the second request after a short wait `/bar` which is fast and
  // does not use the work queue.
  setTimeout(function () {
    http.get({ port, path: '/bar' }, function (res) {
      res.resume()
    })
  }, 100)
  await plan.completed
})

// express did not add array based middleware registration
// without path until 4.9.2
// https://github.com/expressjs/express/blob/master/History.md#492--2014-09-17
if (semver.satisfies(pkgVersion, '>=4.9.2')) {
  test('transaction name with array of middleware with unspecified mount path', async (t) => {
    const plan = tsplan(t, { plan: 3 })
    const { app } = t.nr

    function mid1(req, res, next) {
      plan.ok(1, 'mid1 is executed')
      next()
    }

    function mid2(req, res, next) {
      plan.ok(1, 'mid2 is executed')
      next()
    }

    app.use([mid1, mid2])

    app.get('/path1', (req, res) => {
      res.end()
    })

    runTest({ t, localAssert: plan, endpoint: '/path1' })
    await plan.completed
  })

  test('transaction name when ending in array of unmounted middleware', async (t) => {
    const plan = tsplan(t, { plan: 3 })
    const { app } = t.nr

    function mid1(req, res, next) {
      plan.ok(1, 'mid1 is executed')
      next()
    }

    function mid2(req, res) {
      plan.ok(1, 'mid2 is executed')
      res.end()
    }

    app.use([mid1, mid2])

    app.use(mid1)

    runTest({ t, localAssert: plan, endpoint: '/path1', expectedName: '/' })
    await plan.completed
  })
}

function makeMultiRunner({ t, endpoint, expectedName, numTests, end }) {
  const { agent, port } = t.nr
  let done = 0
  const seen = new Set()
  if (!expectedName) {
    expectedName = endpoint
  }
  agent.on('transactionFinished', function (transaction) {
    assert.ok(!seen.has(transaction), 'should never see the finishing transaction twice')
    seen.add(transaction)
    assert.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET/' + expectedName,
      'transaction has expected name'
    )
    transaction.end()
    if (++done === numTests) {
      done = 0
      end()
    }
  })
  return function runMany() {
    makeRequest(port, endpoint)
  }
}

/**
 * Makes a request and waits for transaction to finish before ending test.
 * You can pass in the assertion library, this is for tests that rely on `tspl`
 * end is optionally called and will be omitted when tests rely on `tspl`
 * to end.
 *
 * @param {object} params to function
 * @param {object} params.t test context
 * @param {string} params.endpoint endpoint
 * @param {string} [params.expectedName] defaults to endpoint if not specified
 * @param {Function} [params.end] function that tells test to end
 * @param {object} [params.localAssert] library for assertions, defaults to `node:assert`
 *
 */
function runTest({ t, endpoint, expectedName, end, localAssert = require('node:assert') }) {
  const { agent, port } = t.nr
  if (!expectedName) {
    expectedName = endpoint
  }
  agent.on('transactionFinished', function (transaction) {
    localAssert.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET/' + expectedName,
      'transaction has expected name'
    )
    end?.()
  })
  makeRequest(port, endpoint)
}
