/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import helper from '../../lib/agent_helper.js'
import http from 'node:http'
import { test } from 'tap'
import semver from 'semver'
/**
 * TODO: Update this later
 * This is in stage 3 and eslint only supports stage 4 and do not want to
 * install babel parsers just for this line
 * See : https://github.com/eslint/eslint/discussions/15305
 *
 */
// import expressPkg from 'express/package.json' assert {type: 'json'}
// const pkgVersion = expressPkg.version
import { readFileSync } from 'node:fs'
const { version: pkgVersion } = JSON.parse(readFileSync('./node_modules/express/package.json'))

test('transaction naming tests', (t) => {
  t.autoend()

  let agent
  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.test('transaction name with single route', async function (t) {
    const { app } = await setup()

    app.get('/path1', function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name with no matched routes', async function (t) {
    const { app } = await setup()

    app.get('/path1', function (req, res) {
      res.end()
    })

    const endpoint = '/asdf'

    await runTest({ app, t, endpoint, expectedName: '(not found)' })
  })

  t.test('transaction name with route that has multiple handlers', async function (t) {
    const { app } = await setup()

    app.get(
      '/path1',
      function (req, res, next) {
        next()
      },
      function (req, res) {
        res.end()
      }
    )

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name with router middleware', async function (t) {
    const { app, express } = await setup()

    const router = new express.Router()
    router.get('/path1', function (req, res) {
      res.end()
    })

    app.use(router)

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name with middleware function', async function (t) {
    const { app } = await setup()

    app.use('/path1', function (req, res, next) {
      next()
    })

    app.get('/path1', function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name with shared middleware function', async function (t) {
    const { app } = await setup()

    app.use(['/path1', '/path2'], function (req, res, next) {
      next()
    })

    app.get('/path1', function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name when ending in shared middleware', async function (t) {
    const { app } = await setup()

    app.use(['/path1', '/path2'], function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/path1', expectedName: '/path1,/path2' })
  })

  t.test('transaction name with subapp middleware', async function (t) {
    const { app, express } = await setup()

    const subapp = express()

    subapp.get('/path1', function middleware(req, res) {
      res.end()
    })

    app.use(subapp)

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('transaction name with subrouter', async function (t) {
    const { app, express } = await setup()

    const router = new express.Router()

    router.get('/path1', function (req, res) {
      res.end()
    })

    app.use('/api', router)

    await runTest({ app, t, endpoint: '/api/path1' })
  })

  t.test(
    'multiple route handlers with the same name do not duplicate transaction name',
    async function (t) {
      const { app } = await setup()

      app.get('/path1', function (req, res, next) {
        next()
      })

      app.get('/path1', function (req, res) {
        res.end()
      })

      await runTest({ app, t, endpoint: '/path1' })
    }
  )

  t.test('responding from middleware', async function (t) {
    const { app } = await setup()

    app.use('/test', function (req, res, next) {
      res.send('ok')
      next()
    })

    await runTest({ app, t, endpoint: '/test' })
  })

  t.test('responding from middleware with parameter', async function (t) {
    const { app } = await setup()

    app.use('/test', function (req, res, next) {
      res.send('ok')
      next()
    })

    await runTest({ app, t, endpoint: '/test/param', expectedName: '/test' })
  })

  t.test('with error', async function (t) {
    const { app } = await setup()

    app.get('/path1', function (req, res, next) {
      next(new Error('some error'))
    })

    app.use(function (err, req, res) {
      return res.status(500).end()
    })

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('with error and path-specific error handler', async function (t) {
    const { app } = await setup()

    app.get('/path1', function () {
      throw new Error('some error')
    })

    app.use('/path1', function(err, req, res, next) { // eslint-disable-line
      res.status(500).end()
    })

    await runTest({ app, t, endpoint: '/path1' })
  })

  t.test('when router error is handled outside of the router', async function (t) {
    const { app, express } = await setup()

    const router = new express.Router()

    router.get('/path1', function (req, res, next) {
      next(new Error('some error'))
    })

    app.use('/router1', router)

    // eslint-disable-next-line no-unused-vars
    app.use(function (err, req, res, next) {
      return res.status(500).end()
    })

    await runTest({ app, t, endpoint: '/router1/path1' })
  })

  t.test('when using a route variable', async function (t) {
    const { app } = await setup()

    app.get('/:foo/:bar', function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/foo/bar', expectedName: '/:foo/:bar' })
  })

  t.test('when using a string pattern in path', async function (t) {
    const { app } = await setup()

    app.get('/ab?cd', function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/abcd', expectedName: '/ab?cd' })
  })

  t.test('when using a regular expression in path', async function (t) {
    const { app } = await setup()

    app.get(/a/, function (req, res) {
      res.end()
    })

    await runTest({ app, t, endpoint: '/abcd', expectedName: '/a/' })
  })

  t.test('when using router with a route variable', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap

    router.get('/:var2/path1', function (req, res) {
      res.end()
    })

    app.use('/:var1', router)

    await runTest({ app, t, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
  })

  t.test('when mounting a subapp using a variable', async function (t) {
    const { app, express } = await setup()

    const subapp = express()
    subapp.get('/:var2/path1', function (req, res) {
      res.end()
    })

    app.use('/:var1', subapp)

    await runTest({ app, t, endpoint: '/foo/bar/path1', expectedName: '/:var1/:var2/path1' })
  })

  t.test('using two routers', async function (t) {
    const { app, express } = await setup()

    const router1 = express.Router() // eslint-disable-line new-cap
    const router2 = express.Router() // eslint-disable-line new-cap

    app.use('/:router1', router1)
    router1.use('/:router2', router2)

    router2.get('/path1', function (req, res) {
      res.end()
    })

    await runTest({
      app,
      t,
      endpoint: '/router1/router2/path1',
      expectedName: '/:router1/:router2/path1'
    })
  })

  t.test('transactions running in parallel should be recorded correctly', async function (t) {
    const { app, express } = await setup()
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
    return new Promise((resolve) => {
      app.listen(async function () {
        const promises = []
        const handlers = []
        for (let i = 0; i < numTests; i++) {
          const data = makeMultiRunner({
            t,
            endpoint: '/router1/router2/path1',
            expectedName: '/:router1/:router2/path1',
            numTests,
            server: this
          })
          promises.push(data.promise)
          handlers.push(data.transactionHandler)
        }

        t.teardown(() => {
          this.close()
          handlers.forEach((handler) => {
            agent.removeListener('transactionFinished', handler)
          })
        })

        await Promise.all(promises)
        resolve()
      })
    })
  })

  t.test('names transaction when request is aborted', async function (t) {
    const { app } = await setup()

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

    const promise = new Promise((resolve) => {
      // eslint-disable-next-line no-unused-vars
      app.use(function (error, req, res, next) {
        t.comment('errorware')
        t.ok(agent.getTransaction() == null, 'no active transaction when responding')
        res.end()
        resolve()
      })
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

    const transactionHandler = function (tx) {
      t.equal(tx.name, 'WebTransaction/Expressjs/GET//test')
    }

    agent.on('transactionFinished', transactionHandler)

    t.teardown(() => {
      server.close()
      agent.removeListener('transactionFinished', transactionHandler)
    })

    return promise
  })

  t.test('Express transaction names are unaffected by errorware', async function (t) {
    const { app } = await setup()

    let transactionHandler = null
    const promise = new Promise((resolve) => {
      transactionHandler = function (tx) {
        const expected = 'WebTransaction/Expressjs/GET//test'
        t.equal(tx.trace.root.children[0].name, expected)
        resolve()
      }
    })

    agent.on('transactionFinished', transactionHandler)

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
      agent.removeListener('transactionFinished', transactionHandler)
    })

    return promise
  })

  t.test('when next is called after transaction state loss', async function (t) {
    // Uninstrumented work queue. This must be set up before the agent is loaded
    // so that no transaction state is maintained.
    const tasks = []
    const interval = setInterval(function () {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    const { app } = await setup()

    let transactionsFinished = 0
    const transactionNames = [
      'WebTransaction/Expressjs/GET//bar',
      'WebTransaction/Expressjs/GET//foo'
    ]

    const transactionHandler = function (tx) {
      t.equal(
        tx.name,
        transactionNames[transactionsFinished++],
        'should have expected name ' + transactionsFinished
      )
    }

    agent.on('transactionFinished', transactionHandler)

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

    let server = null
    const promise = new Promise((resolve) => {
      server = app.listen(function () {
        const port = this.address().port

        // Send first request to `/foo` which is slow and uses the work queue.
        http.get({ port: port, path: '/foo' }, function (res) {
          res.resume()
          res.on('end', function () {
            t.equal(transactionsFinished, 2, 'should have two transactions done')
            resolve()
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
    })

    t.teardown(function () {
      server.close()
      clearInterval(interval)
      agent.removeListener('transactionFinished', transactionHandler)
    })

    return promise
  })

  // express did not add array based middleware registration
  // without path until 4.9.2
  // https://github.com/expressjs/express/blob/master/History.md#492--2014-09-17
  if (semver.satisfies(pkgVersion, '>=4.9.2')) {
    t.test('transaction name with array of middleware with unspecified mount path', async (t) => {
      const { app } = await setup()

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

      await runTest({ app, t, endpoint: '/path1' })
    })

    t.test('transaction name when ending in array of unmounted middleware', async (t) => {
      const { app } = await setup()

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

      await runTest({ app, t, endpoint: '/path1', expectedName: '/' })
    })
  }

  function makeMultiRunner({ t, endpoint, expectedName, numTests, server }) {
    let done = 0
    const seen = new Set()

    let transactionHandler = null
    const promise = new Promise((resolve) => {
      transactionHandler = function (transaction) {
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
          resolve()
        }
      }
    })

    agent.on('transactionFinished', transactionHandler)

    makeRequest(server, endpoint)
    return { promise, transactionHandler }
  }

  function runTest({ app, t, endpoint, expectedName = endpoint }) {
    let transactionHandler = null

    const promise = new Promise((resolve) => {
      transactionHandler = function (transaction) {
        t.equal(
          transaction.name,
          'WebTransaction/Expressjs/GET/' + expectedName,
          'transaction has expected name'
        )
        resolve()
      }
    })

    agent.on('transactionFinished', transactionHandler)

    const server = app.listen(function () {
      makeRequest(this, endpoint)
    })
    t.teardown(() => {
      server.close()
      agent.removeListener('transactionFinished', transactionHandler)
    })

    return promise
  }
})

async function setup() {
  /**
   * This rule is not fully fleshed out and the library is no longer maintained
   * See: https://github.com/mysticatea/eslint-plugin-node/issues/250
   * Fix would be to migrate to use https://github.com/weiran-zsd/eslint-plugin-node
   */

  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const expressExport = await import('express')
  const express = expressExport.default
  const app = express()
  return { app, express }
}

function makeRequest(server, path, callback) {
  const port = server.address().port
  http.request({ port: port, path: path }, callback).end()
}
