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
const { setup, makeRequest, teardown } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

test('Error handling tests', async (t) => {
  t.beforeEach(async (ctx) => {
    await setup(ctx)
  })

  t.afterEach(teardown)

  await t.test('reports error when thrown from a route', function (t, end) {
    const { app } = t.nr

    app.get('/test', function () {
      throw new Error('some error')
    })

    runTest(t, function (errors, statusCode) {
      assert.equal(errors.length, 1)
      assert.equal(statusCode, 500)
      end()
    })
  })

  await t.test('reports error when thrown from a middleware', function (t, end) {
    const { app } = t.nr

    app.use(function () {
      throw new Error('some error')
    })

    runTest(t, function (errors, statusCode) {
      assert.equal(errors.length, 1)
      assert.equal(statusCode, 500)
      end()
    })
  })

  await t.test('reports error when called in next from a middleware', function (t, end) {
    const { app } = t.nr

    app.use(function (req, res, next) {
      next(new Error('some error'))
    })

    runTest(t, function (errors, statusCode) {
      assert.equal(errors.length, 1)
      assert.equal(statusCode, 500)
      end()
    })
  })

  await t.test('should not report error when error handler responds', function (t, end) {
    const { app } = t.nr

    app.get('/test', function () {
      throw new Error('some error')
    })

    app.use(function (_, req, res, next) {
      res.end()
    })

    runTest(t, function (errors, statusCode) {
      assert.equal(errors.length, 0)
      assert.equal(statusCode, 200)
      end()
    })
  })

  await t.test(
    'should report error when error handler responds, but sets error status code',
    function (t, end) {
      const { app } = t.nr

      app.get('/test', function () {
        throw new Error('some error')
      })

      app.use(function (_, req, res, next) {
        res.status(400).end()
      })

      runTest(t, function (errors, statusCode) {
        assert.equal(errors.length, 1)
        assert.equal(errors[0][2], 'some error')
        assert.equal(statusCode, 400)
        end()
      })
    }
  )

  await t.test('should report errors passed out of errorware', function (t, end) {
    const { app } = t.nr

    app.get('/test', function () {
      throw new Error('some error')
    })

    app.use(function (error, req, res, next) {
      next(error)
    })

    runTest(t, function (errors, statuscode) {
      assert.equal(errors.length, 1)
      assert.equal(statuscode, 500)
      end()
    })
  })

  await t.test('should report errors from errorware followed by routes', function (t, end) {
    const { app } = t.nr

    app.use(function () {
      throw new Error('some error')
    })

    app.use(function (error, req, res, next) {
      next(error)
    })

    app.get('/test', function (req, res) {
      res.end()
    })

    runTest(t, function (errors, statuscode) {
      assert.equal(errors.length, 1)
      assert.equal(statuscode, 500)
      end()
    })
  })

  await t.test('should not report errors swallowed by errorware', function (t, end) {
    const { app } = t.nr

    app.get('/test', function () {
      throw new Error('some error')
    })

    app.use(function (_, req, res, next) {
      next()
    })

    app.get('/test', function (req, res) {
      res.end()
    })

    runTest(t, function (errors, statuscode) {
      assert.equal(errors.length, 0)
      assert.equal(statuscode, 200)
      end()
    })
  })

  await t.test('should not report errors handled by errorware outside router', function (t, end) {
    const { app, express } = t.nr

    const router1 = express.Router()
    router1.get('/test', function () {
      throw new Error('some error')
    })

    app.use(router1)

    app.use(function (_, req, res, next) {
      res.end()
    })

    runTest(t, function (errors, statuscode) {
      assert.equal(errors.length, 0)
      assert.equal(statuscode, 200)
      end()
    })
  })

  await t.test('does not error when request is aborted', async function (t) {
    const plan = tsplan(t, { plan: 5 })
    const { app, agent, port } = t.nr
    let request = null

    app.get('/test', function (req, res, next) {
      plan.ok(agent.getTransaction(), 'transaction exists')

      // generate error after client has aborted
      request.abort()
      setTimeout(function () {
        plan.equal(agent.getTransaction(), null, 'transaction has already ended')
        next(new Error('some error'))
      }, 100)
    })

    app.use(function (error, req, res, next) {
      plan.equal(error.message, 'some error')
      plan.equal(agent.getTransaction(), null, 'no active transaction when responding')
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
    await plan.completed
  })
})

function runTest(t, callback) {
  let statusCode
  let errors
  const { agent, port } = t.nr

  agent.on('transactionFinished', function () {
    errors = agent.errors.traceAggregator.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  const endpoint = '/test'
  makeRequest(port, endpoint, function (response) {
    statusCode = response.statusCode
    if (errors) {
      callback(errors, statusCode)
    }
    response.resume()
  })
}
