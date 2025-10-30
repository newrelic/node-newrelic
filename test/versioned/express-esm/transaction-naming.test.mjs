/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import semver from 'semver'
import tspl from '@matteo.collina/tspl'

import helper from '../../lib/agent_helper.js'
import expressHelpers from './helpers.mjs'

// import expressPkg from 'express/package.json' assert {type: 'json'}
// const pkgVersion = expressPkg.version
import { readFileSync } from 'node:fs'
const { version: pkgVersion } = JSON.parse(readFileSync('./node_modules/express/package.json'))
const isExpress5 = semver.gte(pkgVersion, '5.0.0')

const { setup, makeRequest, makeRequestAndFinishTransaction } = expressHelpers

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const { app, express } = await setup()
  ctx.nr.app = app
  ctx.nr.express = express

  await new Promise((resolve) => {
    const server = app.listen(() => {
      ctx.nr.server = server
      resolve()
    })
  })
})

test.afterEach((ctx) => {
  ctx.nr.server.close()
  helper.unloadAgent(ctx.nr.agent)
})

test('transaction name with single route', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/path1', function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name with no matched routes', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/path1', function (req, res) {
    res.end()
  })

  const endpoint = '/asdf'
  const txPrefix = isExpress5 ? 'WebTransaction/Nodejs' : 'WebTransaction/Expressjs'
  await runTest({ agent, server, endpoint, txPrefix, expectedName: '(not found)' })
})

test('transaction name with route that has multiple handlers', async (t) => {
  const { agent, app, server } = t.nr

  app.get(
    '/path1',
    function (req, res, next) {
      next()
    },
    function (req, res) {
      res.end()
    }
  )

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name with router middleware', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = new express.Router()
  router.get('/path1', function (req, res) {
    res.end()
  })

  app.use(router)

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name with middleware function', async (t) => {
  const { agent, app, server } = t.nr

  app.use('/path1', function (req, res, next) {
    next()
  })

  app.get('/path1', function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name with shared middleware function', async (t) => {
  const { agent, app, server } = t.nr

  app.use(['/path1', '/path2'], function (req, res, next) {
    next()
  })

  app.get('/path1', function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name when ending in shared middleware', async (t) => {
  const { agent, app, server } = t.nr

  app.use(['/path1', '/path2'], function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/path1', expectedName: '/path1,/path2' })
})

test('transaction name with subapp middleware', async (t) => {
  const { agent, app, express, server } = t.nr

  const subapp = express()

  subapp.get('/path1', function middleware(req, res) {
    res.end()
  })

  app.use(subapp)

  await runTest({ agent, server, endpoint: '/path1' })
})

test('transaction name with subrouter', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = new express.Router()

  router.get('/path1', function (req, res) {
    res.end()
  })

  app.use('/api', router)

  await runTest({ agent, server, endpoint: '/api/path1' })
})

test('multiple route handlers with the same name do not duplicate transaction name', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/path1', function (req, res, next) {
    next()
  })

  app.get('/path1', function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('responding from middleware', async (t) => {
  const { agent, app, server } = t.nr

  app.use('/test', function (req, res, next) {
    res.send('ok')
    next()
  })

  await runTest({ agent, server, endpoint: '/test' })
})

test('responding from middleware with parameter', async (t) => {
  const { agent, app, server } = t.nr

  app.use('/test', function (req, res, next) {
    res.send('ok')
    next()
  })

  await runTest({ agent, server, endpoint: '/test/param', expectedName: '/test' })
})

test('with error', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/path1', function (req, res, next) {
    next(Error('some error'))
  })

  app.use(function (_, req, res, next) {
    res.status(500).end()
    next()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('with error and path-specific error handler', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/path1', function () {
    throw new Error('some error')
  })

  app.use('/path1', function (_, req, res, next) {
    res.status(500).end()
    next()
  })

  await runTest({ agent, server, endpoint: '/path1' })
})

test('when router error is handled outside of the router', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = new express.Router()

  router.get('/path1', function (req, res, next) {
    next(new Error('some error'))
  })

  app.use('/router1', router)

  app.use(function (_, req, res, next) {
    res.status(500).end()
    next()
  })

  await runTest({ agent, server, endpoint: '/router1/path1' })
})

test('when using a route variable', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/:foo/:bar', function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/foo/bar', expectedName: '/:foo/:bar' })
})

test('when using a string pattern in path', async (t) => {
  const { agent, app, server } = t.nr
  const path = isExpress5 ? /ab?cd/ : '/ab?cd'

  app.get(path, function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/abcd', expectedName: '/ab?cd' })
})

test('when using a regular expression in path', async (t) => {
  const { agent, app, server } = t.nr

  app.get(/a/, function (req, res) {
    res.end()
  })

  await runTest({ agent, server, endpoint: '/abcd', expectedName: '/a' })
})

test('when using router with a route variable', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()

  router.get('/:var2/path1', function (req, res) {
    res.end()
  })

  app.use('/:var1', router)

  await runTest({ agent, server, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
})

test('when mounting a subapp using a variable', async (t) => {
  const { agent, app, express, server } = t.nr

  const subapp = express()
  subapp.get('/:var2/path1', function (req, res) {
    res.end()
  })

  app.use('/:var1', subapp)

  await runTest({ agent, server, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
})

test('using two routers', async (t) => {
  const { agent, app, express, server } = t.nr

  const router1 = express.Router()
  const router2 = express.Router()

  app.use('/:router1', router1)
  router1.use('/:router2', router2)

  router2.get('/path1', function (req, res) {
    res.end()
  })

  await runTest({
    agent,
    server,
    endpoint: '/router1/router2/path1',
    expectedName: '/:router1/:router2/path1'
  })
})

test('transactions running in parallel should be recorded correctly', async (t) => {
  const { agent, app, express, server } = t.nr
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
  const promises = []
  for (let i = 0; i < numTests; i++) {
    const data = makeMultiRunner({
      agent,
      endpoint: '/router1/router2/path1',
      expectedName: '/:router1/:router2/path1',
      numTests,
      server
    })
    promises.push(data.promise)
  }

  await Promise.all(promises)
})

test('names transaction when request is aborted', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent, app, server } = t.nr

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

  const promise = new Promise((resolve) => {
    app.use(function (error, req, res, next) {
      plan.equal(error.message, 'some error')
      plan.ok(agent.getTransaction() == null, 'no active transaction when responding')
      res.end()
      resolve()
    })
  })

  const transactionHandler = function (tx) {
    plan.equal(tx.name, 'WebTransaction/Expressjs/GET//test')
  }

  agent.on('transactionFinished', transactionHandler)

  request = http.request({ ...server.address(), path: '/test' })
  request.on('error', () => {
    // No-op error handler to suppress logging of the error to console.
  })
  request.end()

  await Promise.all([promise, plan.completed])
})

test('Express transaction names are unaffected by errorware', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, app, server } = t.nr

  let transactionHandler = null
  const promise = new Promise((resolve) => {
    transactionHandler = function (tx) {
      const expected = 'WebTransaction/Expressjs/GET//test'
      const [baseSegment] = tx.trace.getChildren(tx.trace.root.id)
      plan.equal(baseSegment.name, expected)
      resolve()
    }
  })

  agent.on('transactionFinished', transactionHandler)

  app.use('/test', function () {
    throw Error('endpoint error')
  })

  app.use('/test', function (err, req, res, next) {
    res.send(err.message)
    next()
  })

  http.request({ ...server.address(), path: '/test' }).end()

  await Promise.all([promise, plan.completed])
})

test('when next is called after transaction state loss', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent, app, server } = t.nr

  // Uninstrumented work queue.
  const tasks = []
  const interval = setInterval(function () {
    if (tasks.length) {
      tasks.pop()()
    }
  }, 10)
  t.after(() => clearInterval(interval))

  let transactionsFinished = 0
  const transactionNames = [
    'WebTransaction/Expressjs/GET//bar',
    'WebTransaction/Expressjs/GET//foo'
  ]

  agent.on('transactionFinished', (tx) => {
    transactionsFinished += 1
    plan.equal(transactionNames.includes(tx.name), true, 'should have expected name ' + tx.name)
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
  http
    .request({ ...server.address(), path: '/foo' }, (res) => {
      res.resume()
      res.on('end', () => {
        plan.equal(transactionsFinished, 2, 'should have two transactions done')
      })
    })
    .end()

  // Send the second request after a short wait to `/bar` which is fast
  // and does not use the work queue.
  setTimeout(() => {
    http.request({ ...server.address(), path: '/bar' }).end()
  }, 100)

  await plan.completed
})

// express did not add array based middleware registration
// without path until 4.9.2
// https://github.com/expressjs/express/blob/master/History.md#492--2014-09-17
const supportsArrayMiddleware = semver.satisfies(pkgVersion, '>=4.9.2')

test(
  'transaction name with array of middleware with unspecified mount path',
  { skip: supportsArrayMiddleware === false },
  async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, app, server } = t.nr

    function mid1(req, res, next) {
      plan.ok('mid1 is executed')
      next()
    }

    function mid2(req, res, next) {
      plan.ok('mid2 is executed')
      next()
    }

    app.use([mid1, mid2])

    app.get('/path1', (req, res) => {
      res.end()
    })

    await runTest({ agent, server, endpoint: '/path1' })
    await plan.completed
  }
)

test(
  'transaction name when ending in array of unmounted middleware',
  { skip: supportsArrayMiddleware === false },
  async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent, app, server } = t.nr

    function mid1(req, res, next) {
      plan.ok('mid1 is executed')
      next()
    }

    function mid2(req, res) {
      plan.ok('mid2 is executed')
      res.end()
    }

    app.use([mid1, mid2])

    app.use(mid1)

    await runTest({ agent, server, endpoint: '/path1', expectedName: '/' })
    await plan.completed
  }
)

function makeMultiRunner({ agent, endpoint, expectedName, numTests, server }) {
  let done = 0
  const seen = new Set()

  let transactionHandler = null
  const promise = new Promise((resolve) => {
    transactionHandler = function (transaction) {
      assert.equal(seen.has(transaction), false, 'should never see the finishing transaction twice')
      seen.add(transaction)
      assert.equal(
        transaction.name,
        'WebTransaction/Expressjs/GET/' + expectedName,
        'transaction has expected name'
      )
      transaction.end()
      if (++done === numTests) {
        done = 0
        resolve()
      }
    }
  })

  agent.on('transactionFinished', transactionHandler)

  makeRequest(server, endpoint)
  return { promise, transactionHandler }
}

async function runTest({
  agent,
  server,
  endpoint,
  expectedName = endpoint,
  txPrefix = 'WebTransaction/Expressjs'
}) {
  const transaction = await makeRequestAndFinishTransaction({ agent, server, endpoint })
  assert.equal(transaction.name, `${txPrefix}/GET/${expectedName}`, 'transaction has expected name')
}
