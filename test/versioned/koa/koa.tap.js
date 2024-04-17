/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const http = require('http')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')

tap.test('Koa instrumentation', (t) => {
  t.autoend()

  t.beforeEach(() => {
    t.context.agent = helper.instrumentMockedAgent()
    const Koa = require('koa')
    t.context.app = new Koa()
    t.context.testShim = helper.getShim(Koa)
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('Should name after koa framework and verb when body set', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next().then(() => {
        // do nothing
      })
    })

    app.use(function two(ctx) {
      ctx.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//',
        'should have name without post-response name info'
      )
    })

    run(t)
  })

  t.test('Should name (not found) when no work is performed', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next().then(() => {
        // do nothing
      })
    })

    app.use(function two() {
      // do nothing
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
        'should name after status code message'
      )
    })

    run(t, 'Not Found')
  })

  t.test('names the transaction after the middleware that sets the body', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      const tx = agent.getTransaction()
      return next().then(() => tx.nameState.appendPath('one-end'))
    })

    app.use(function two(ctx) {
      const tx = agent.getTransaction()
      tx.nameState.appendPath('two')
      ctx.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//two',
        'should have name without post-response name info'
      )
    })

    run(t)
  })

  t.test('names the transaction after the last middleware that sets the body', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      const tx = agent.getTransaction()
      return next().then(() => tx.nameState.appendPath('one-end'))
    })

    app.use(function two(ctx, next) {
      const tx = agent.getTransaction()
      tx.nameState.appendPath('two')
      ctx.body = 'not actually done'
      return next()
    })

    app.use(function three(ctx) {
      const tx = agent.getTransaction()
      tx.nameState.appendPath('three')
      ctx.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//three',
        'should have name without post-response name info'
      )
    })

    run(t)
  })

  t.test('names the transaction off the status setting middleware', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      const tx = agent.getTransaction()
      return next().then(() => tx.nameState.appendPath('one-end'))
    })

    app.use(function two(ctx) {
      const tx = agent.getTransaction()
      tx.nameState.appendPath('two')
      ctx.status = 202
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//two',
        'should have name without post-response name info'
      )
    })

    run(t, 'Accepted', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 202, 'should not interfere with status code setting')
      t.end()
    })
  })

  t.test('names the transaction when body set even if status set after', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      const tx = agent.getTransaction()
      return next().then(() => tx.nameState.appendPath('one-end'))
    })

    app.use(function two(ctx) {
      const tx = agent.getTransaction()
      tx.nameState.appendPath('two')
      ctx.body = 'done'

      tx.nameState.appendPath('setting-status')
      ctx.status = 202
    })

    agent.on('transactionFinished', (tx) => {
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//two',
        'should have name without post-response name info'
      )
    })

    run(t, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 202, 'should not interfere with status code setting')
      t.end()
    })
  })

  t.test('produces transaction trace with multiple middleware', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next()
    })
    app.use(function two(ctx) {
      ctx.response.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      checkSegments(t, tx)
    })

    run(t)
  })

  t.test('correctly records actions interspersed among middleware', (t) => {
    const { agent, app, testShim } = t.context

    app.use(function one(ctx, next) {
      testShim.createSegment('testSegment')
      return next().then(function () {
        testShim.createSegment('nestedSegment')
      })
    })
    app.use(function two(ctx, next) {
      return new Promise(function (resolve) {
        setTimeout(resolve, 10)
      }).then(next)
    })
    app.use(function three(ctx) {
      ctx.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//',
        [
          'Nodejs/Middleware/Koa/one',
          [
            'Truncated/testSegment',
            'Nodejs/Middleware/Koa/two',
            ['timers.setTimeout', ['Callback: <anonymous>'], 'Nodejs/Middleware/Koa/three'],
            'Truncated/nestedSegment'
          ]
        ]
      ])
    })

    run(t)
  })

  t.test('maintains transaction state between middleware', (t) => {
    const { agent, app } = t.context
    let tx

    app.use(async function one(ctx, next) {
      tx = agent.getTransaction()

      await next()

      t.ok(tx)
    })

    app.use(async function two(ctx, next) {
      t.equal(tx.id, agent.getTransaction().id, 'two has transaction context')
      await next()
    })

    app.use(function three(ctx, next) {
      t.equal(tx.id, agent.getTransaction().id, 'three has transaction context')
      return new Promise((resolve) => {
        setImmediate(() => {
          next().then(() => {
            t.equal(
              tx.id,
              agent.getTransaction().id,
              'still have context after in-context timer hop'
            )
            resolve()
          })
        })
      })
    })

    app.use(function four(ctx) {
      t.equal(tx.id, agent.getTransaction().id, 'four has transaction context')
      ctx.body = 'done'
    })

    agent.on('transactionFinished', function (txn) {
      t.assertSegments(tx.trace.root, [
        txn.name,
        [
          'Nodejs/Middleware/Koa/one',
          [
            'Nodejs/Middleware/Koa/two',
            ['Nodejs/Middleware/Koa/three', ['Nodejs/Middleware/Koa/four']]
          ]
        ]
      ])
    })

    run(t)
  })

  t.test('errors handled within middleware are not recorded', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next().catch(function (err) {
        t.equal(err.message, 'middleware error', 'caught expected error')
        ctx.status = 200
        ctx.body = 'handled error'
      })
    })
    app.use(function two(ctx) {
      throw new Error('middleware error')
      ctx.body = 'done'
    })

    agent.on('transactionFinished', (tx) => {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 0, 'no errors are recorded')
      checkSegments(t, tx)
    })

    run(t, 'handled error')
  })

  t.test('errors not handled by middleware are recorded', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next().catch(function (err) {
        t.equal(err.message, 'middleware error', 'caught expected error')
        ctx.status = 500
        ctx.body = 'error is not actually handled'
      })
    })
    app.use(function two() {
      throw new Error('middleware error')
    })

    agent.on('transactionFinished', (tx) => {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1, 'recorded expected number of errors')
      const error = errors[0][2]
      t.equal(error, 'middleware error', 'recorded expected error')
      checkSegments(t, tx)
    })
    run(t, 'error is not actually handled')
  })

  t.test('errors caught by default error listener are recorded', (t) => {
    const { agent, app } = t.context

    app.use(function one(ctx, next) {
      return next()
    })
    app.use(function two() {
      throw new Error('middleware error')
    })
    app.on('error', function (err) {
      t.equal(err.message, 'middleware error', 'caught expected error')
    })

    agent.on('transactionFinished', (tx) => {
      const errors = agent.errors.traceAggregator.errors
      t.equal(errors.length, 1, 'recorded expected number of errors')
      const error = errors[0][2]
      t.equal(error, 'middleware error', 'recorded expected error')
      checkSegments(t, tx)
    })
    run(t, 'Internal Server Error')
  })

  function run(t, expected, cb) {
    if (typeof expected !== 'string') {
      // run(t [, cb])
      cb = expected
      expected = 'done'
    }

    t.context.server = t.context.app.listen(0, () => {
      http.get({ port: t.context.server.address().port }, (res) => {
        let body = ''
        res.on('data', (data) => (body += data.toString('utf8')))
        res.on('error', (err) => cb && cb(err))
        res.on('end', () => {
          if (expected) {
            t.equal(body, expected, 'should send expected response')
          }

          if (!cb) {
            t.end()
            return
          }

          cb(null, res)
        })
      })
    })
  }
})

function checkSegments(t, tx) {
  t.assertSegments(tx.trace.root, [
    // Until koa-router is instrumented and transaction naming is addressed,
    // names will be inconsistent depending on whether there is an error.
    tx.name,
    ['Nodejs/Middleware/Koa/one', ['Nodejs/Middleware/Koa/two']]
  ])
}
