/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// shut up, Express
process.env.NODE_ENV = 'test'
const assert = require('node:assert')
const test = require('node:test')
const path = require('node:path')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const { setup, teardown, TEST_URL } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

const TEST_PATH = '/test'
const DELAY = 600
const BODY =
  '<!DOCTYPE html>\n' +
  '<html>\n' +
  '<head>\n' +
  '  <title>yo dawg</title>\n' +
  '</head>\n' +
  '<body>\n' +
  '  <p>I heard u like HTML.</p>\n' +
  '</body>\n' +
  '</html>\n'

// Regression test for issue 154
// https://github.com/newrelic/node-newrelic/pull/154
test('using only the express router', function (t, end) {
  const agent = helper.instrumentMockedAgent()
  const router = require('express').Router()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  assert.doesNotThrow(() => {
    router.get('/test', function () {})
    router.get('/test2', function () {})
  })

  end()
})

test('the express router should go through a whole request lifecycle', async function (t) {
  const agent = helper.instrumentMockedAgent()
  const router = require('express').Router()
  const finalhandler = require('finalhandler')

  const plan = tsplan(t, { plan: 2 })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  router.get(TEST_PATH, function (_, res) {
    plan.ok(true)
    res.end()
  })

  const server = require('http').createServer(function onRequest(req, res) {
    router(req, res, finalhandler(req, res))
  })
  server.listen(0, function () {
    const port = server.address().port
    helper.makeRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error) {
      server.close()

      plan.ok(!error)
    })
  })
  await plan.completed
})

test('agent instrumentation of Express', async function (t) {
  t.beforeEach(async function (ctx) {
    await setup(ctx)
  })

  t.afterEach(teardown)

  await t.test('for a normal request', { timeout: 1000 }, function (t, end) {
    const { app, agent, port } = t.nr
    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    app.get(TEST_PATH, function (req, res) {
      res.send({ yep: true })
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error, response, body) {
      assert.ok(!error, 'should not fail making request')

      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )

      assert.deepEqual(body, { yep: true }, 'Express correctly serves.')

      let stats

      stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
      assert.ok(stats, 'found unscoped stats for request path')
      assert.equal(stats.callCount, 1, '/test was only requested once')

      stats = agent.metrics.getMetric('Apdex/Expressjs/GET//test')
      assert.ok(stats, 'found apdex stats for request path')
      assert.equal(stats.satisfying, 1, 'got satisfactory response time')
      assert.equal(stats.tolerating, 0, 'got no tolerable requests')
      assert.equal(stats.frustrating, 0, 'got no frustrating requests')

      stats = agent.metrics.getMetric('WebTransaction')
      assert.ok(stats, 'found roll-up statistics for web requests')
      assert.equal(stats.callCount, 1, 'only one web request was made')

      stats = agent.metrics.getMetric('HttpDispatcher')
      assert.ok(stats, 'found HTTP dispatcher statistics')
      assert.equal(stats.callCount, 1, 'only one HTTP-dispatched request was made')

      const serialized = JSON.stringify(agent.metrics._toPayloadSync())
      assert.ok(
        serialized.match(/WebTransaction\/Expressjs\/GET\/\/test/),
        'serialized metrics as expected'
      )

      end()
    })
  })

  await t.test(
    'ignore apdex when ignoreApdex is true on transaction',
    { timeout: 1000 },
    function (t, end) {
      const { app, agent, port } = t.nr
      // set apdexT so apdex stats will be recorded
      agent.config.apdex_t = 1

      app.get(TEST_PATH, function (req, res) {
        const tx = agent.getTransaction()
        tx.ignoreApdex = true
        res.send({ yep: true })
      })

      helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
        let stats

        stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
        assert.ok(stats, 'found unscoped stats for request path')
        assert.equal(stats.callCount, 1, '/test was only requested once')

        stats = agent.metrics.getMetric('Apdex/Expressjs/GET//test')
        assert.ok(!stats, 'should not have apdex metrics')

        stats = agent.metrics.getMetric('WebTransaction')
        assert.ok(stats, 'found roll-up statistics for web requests')
        assert.equal(stats.callCount, 1, 'only one web request was made')

        stats = agent.metrics.getMetric('HttpDispatcher')
        assert.ok(stats, 'found HTTP dispatcher statistics')
        assert.equal(stats.callCount, 1, 'only one HTTP-dispatched request was made')
        end()
      })
    }
  )

  await t.test('using EJS templates', { timeout: 1000 }, async function (t) {
    const plan = tsplan(t, { plan: 4 })
    const { app, agent, port } = t.nr
    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'ejs')

    app.get(TEST_PATH, function (req, res) {
      res.render('index', { title: 'yo dawg' })
    })

    agent.once('transactionFinished', function () {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      plan.equal(stats.callCount, 1, 'should note the view rendering')
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error, response, body) {
      plan.ok(!error, 'should not error making request')

      plan.equal(response.statusCode, 200, 'response code should be 200')
      plan.equal(body, BODY, 'template should still render fine')
    })
    await plan.completed
  })

  await t.test('should generate rum headers', { timeout: 1000 }, async function (t) {
    const plan = tsplan(t, { plan: 5 })
    const { app, agent, port } = t.nr
    const api = new API(agent)

    agent.config.license_key = 'license_key'
    agent.config.application_id = '12345'
    agent.config.browser_monitoring.browser_key = '12345'
    agent.config.browser_monitoring.js_agent_loader = 'function() {}'

    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'ejs')

    app.get(TEST_PATH, function (req, res) {
      const rum = api.getBrowserTimingHeader()
      plan.equal(rum.substring(0, 7), '<script')
      res.render('index', { title: 'yo dawg', rum })
    })

    agent.once('transactionFinished', function () {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      plan.equal(stats.callCount, 1, 'should note the view rendering')
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error, response, body) {
      plan.ok(!error, 'should not error making request')

      plan.equal(response.statusCode, 200, 'response code should be 200')
      plan.equal(body, BODY, 'template should still render fine')
    })
    await plan.completed
  })

  await t.test('should trap errors correctly', function (t, end) {
    const { app, agent, port } = t.nr
    app.get(TEST_PATH, function () {
      let hmm
      hmm.ohno.failure.is.terrible()
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error, response, body) {
      assert.ok(!error, 'should not error making request')

      assert.ok(response, 'got a response from Express')
      assert.ok(body, 'got back a body')

      const errors = agent.errors.traceAggregator.errors
      assert.ok(errors, 'errors were found')
      assert.equal(errors.length, 1, 'Only one error thrown.')

      const first = errors[0]
      assert.ok(first, 'have the first error')

      // The error msg changed in v16.9
      // change assertion to check for an include of
      // diff msgs
      const expectedError = [
        "Cannot read property 'ohno' of undefined",
        "Cannot read properties of undefined (reading 'ohno')"
      ]
      assert.ok(
        expectedError.includes(first[2]),
        "Cannot read property 'ohno' of undefined",
        'got the expected error'
      )

      end()
    })
  })

  await t.test('measure request duration properly (NA-46)', { timeout: 2000 }, function (t, end) {
    const { app, agent, port } = t.nr
    app.get(TEST_PATH, function (req, res) {
      assert.ok(agent.getTransaction(), 'should have transaction inside middleware')
      setTimeout(function () {
        res.send(BODY)
      }, DELAY)
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (error, response, body) {
      assert.ok(!error, 'should not fail making request')

      const isFramework = agent.environment.get('Framework').indexOf('Expressjs') > -1
      assert.ok(isFramework, 'should indicate that express is a framework')

      assert.ok(!agent.getTransaction(), "transaction shouldn't be visible from request")
      assert.equal(body, BODY, 'response and original page text match')

      const stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
      assert.ok(stats, 'Statistics should have been found for request.')

      const timing = stats.total * 1000
      assert.ok(timing > DELAY - 50, 'should have expected timing (within reason)')

      end()
    })
  })

  await t.test('should capture URL correctly with a prefix', { timeout: 2000 }, function (t, end) {
    const { app, agent, port } = t.nr
    app.use(TEST_PATH, function (req, res) {
      assert.ok(agent.getTransaction(), 'should maintain transaction state in middleware')
      assert.equal(req.url, '/ham', 'should have correct test url')
      res.send(BODY)
    })

    const url = `${TEST_URL}:${port}${TEST_PATH}/ham`
    helper.makeGetRequest(url, function (error, response, body) {
      assert.ok(!error, 'should not fail making request')

      assert.ok(!agent.getTransaction(), "transaction shouldn't be visible from request")
      assert.equal(body, BODY, 'response and original page text match')

      const stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
      assert.ok(stats, 'Statistics should have been found for request.')

      end()
    })
  })

  await t.test('collects the actual error object that is thrown', function (t, end) {
    const { agent, app, port } = t.nr
    app.get(TEST_PATH, function () {
      throw new Error('some error')
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'some error', 'got the expected error')
      assert.ok(errors[0][4].stack_trace, 'has stack trace')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 1, 'apdex should be frustrating')

      end()
    })
  })

  await t.test('does not occur with custom defined error handlers', function (t, end) {
    const { agent, app, port } = t.nr
    const error = new Error('some error')

    app.get(TEST_PATH, function () {
      throw error
    })

    app.use(function (err, req, res, next) {
      assert.equal(err, error, 'should see the same error in the error handler')
      next()
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 0, 'there should be no errors')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 0, 'apdex should not be frustrating')

      end()
    })
  })

  await t.test('does not occur with custom defined error handlers', function (t, end) {
    const { agent, app, port } = t.nr
    const error = new Error('some error')

    app.get(TEST_PATH, function (req, res, next) {
      next(error)
    })

    app.use(function (err, req, res, next) {
      assert.equal(err, error, 'should see the same error in the error handler')
      next()
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 0, 'there should be no errors')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 0, 'apdex should not be frustrating')

      end()
    })
  })

  await t.test('collects the error message when string is thrown', function (t, end) {
    const { agent, app, port } = t.nr

    app.get(TEST_PATH, function () {
      // eslint-disable-next-line no-throw-literal
      throw 'some error'
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'some error', 'got the expected error')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 1, 'apdex should be frustrating')

      end()
    })
  })

  await t.test('collects the actual error object when error handler is used', function (t, end) {
    const { agent, app, port } = t.nr
    app.get(TEST_PATH, function () {
      throw new Error('some error')
    })

    app.use(function (_, rer, res, next) {
      res.status(400).end()
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'some error', 'got the expected error')
      assert.ok(errors[0][4].stack_trace, 'has stack trace')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 1, 'apdex should be frustrating')

      end()
    })
  })

  // Some error handlers might sanitize the error object, removing stack and/or message
  // properties, so that it can be serialized and sent back in the response body.
  // We use message and stack properties to identify an Error object, so in this case
  // we want to at least collect the HTTP error based on the status code.
  await t.test('should report errors without message or stack sent to res.send', function (t, end) {
    const { agent, app, port } = t.nr
    const error = new Error('some error')
    app.get(TEST_PATH, function () {
      throw error
    })

    app.use(function (err, rer, res, next) {
      delete err.message
      delete err.stack
      res.status(400).send(err)
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'HttpError 400', 'got the expected error')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 1, 'apdex should be frustrating')

      end()
    })
  })

  await t.test('should report errors without message or stack sent to next', function (t, end) {
    const { agent, app, port } = t.nr

    const error = new Error('some error')
    app.get(TEST_PATH, function () {
      throw error
    })

    app.use(function errorHandler(err, rer, res, next) {
      delete err.message
      delete err.stack
      next(err)
    })

    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function () {
      const errors = agent.errors.traceAggregator.errors
      assert.equal(errors.length, 1, 'there should be one error')
      assert.equal(errors[0][2], 'HttpError 500', 'got the expected error')

      const metric = agent.metrics.getMetric('Apdex')
      assert.ok(metric.frustrating === 1, 'apdex should be frustrating')

      end()
    })
  })

  await t.test('layer wrapping', async function (t) {
    const { app, port } = t.nr
    const plan = tsplan(t, { plan: 2 })
    // Add our route.
    app.get(TEST_PATH, function (req, res) {
      res.send('bar')
    })

    // Proxy the last layer on the stack.
    const router = app._router || app.router
    const stack = router.stack
    stack[stack.length - 1] = makeProxyLayer(stack[stack.length - 1])

    // Make our request.
    helper.makeGetRequest(`${TEST_URL}:${port}${TEST_PATH}`, function (err, response, body) {
      plan.ifError(err)
      plan.equal(body, 'bar', 'should not fail with a proxy layer')
    })
    await plan.completed
  })
})

/**
 * Wraps a layer in a proxy with all of the layer's prototype's methods directly
 * on itself.
 *
 * @param {Express.Layer} layer - The layer to proxy.
 *
 * @returns {object} A POD object with all the fields of the layer copied over.
 */
function makeProxyLayer(layer) {
  const fakeLayer = {
    handle_request: function () {
      layer.handle_request.apply(layer, arguments)
    },
    handle_error: function () {
      layer.handle_error.apply(layer, arguments)
    }
  }
  Object.keys(layer).forEach(function (k) {
    if (!fakeLayer[k]) {
      fakeLayer[k] = layer[k]
    }
  })
  Object.keys(layer.constructor.prototype).forEach(function (k) {
    if (!fakeLayer[k]) {
      fakeLayer[k] = layer[k]
    }
  })
  return fakeLayer
}
