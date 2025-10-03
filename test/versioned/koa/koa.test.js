/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const http = require('node:http')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const Koa = require('koa')
  ctx.nr.app = new Koa()
  ctx.nr.testShim = helper.getShim(Koa)
})

test.afterEach((ctx) => {
  if (ctx.nr.server) {
    ctx.nr.server.close()
  }
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['koa'])
})

function run({ t, expected = 'done', cb, end, plan }) {
  t.nr.server = t.nr.app.listen(0, () => {
    http.get({ port: t.nr.server.address().port }, (res) => {
      let body = ''
      res.on('data', (data) => {
        body += data.toString('utf8')
      })
      res.on('error', (err) => cb && cb(err))
      res.on('end', () => {
        if (expected) {
          plan.equal(body, expected, 'should send expected response')
        }

        if (!cb) {
          end && end()
          return
        }

        cb(null, res)
      })
    })
  })
}

function checkSegments(plan, tx) {
  assertSegments(
    tx.trace,
    tx.trace.root,
    [
      // Until koa-router is instrumented and transaction naming is addressed,
      // names will be inconsistent depending on whether there is an error.
      tx.name,
      ['Nodejs/Middleware/Koa/one', ['Nodejs/Middleware/Koa/two']]
    ],
    {},
    { assert: plan }
  )
  assertSpanKind({
    agent: tx.agent,
    segments: [
      { name: tx.name, kind: 'server' },
      { name: 'Nodejs/Middleware/Koa/one', kind: 'internal' },
      { name: 'Nodejs/Middleware/Koa/two', kind: 'internal' }
    ]
  })
}

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('koa/package.json')
  assertPackageMetrics({ agent, pkg: 'koa', version })
})

test('Should name after koa framework and verb when body set', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next().then(() => {
      // do nothing
    })
  })

  app.use(function two(ctx) {
    ctx.body = 'done'
  })

  agent.on('transactionFinished', (tx) => {
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//',
      'should have name without post-response name info'
    )
  })

  run({ t, plan })
  await plan.completed
})

test('Should name (not found) when no work is performed', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next().then(() => {
      // do nothing
    })
  })

  app.use(function two() {
    // do nothing
  })

  agent.on('transactionFinished', (tx) => {
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
      'should name after status code message'
    )
  })

  run({ t, expected: 'Not Found', plan })
  await plan.completed
})

test('names the transaction after the middleware that sets the body', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, app } = t.nr

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
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//two',
      'should have name without post-response name info'
    )
  })

  run({ t, plan })
  await plan.completed
})

test('names the transaction after the last middleware that sets the body', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, app } = t.nr

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
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//three',
      'should have name without post-response name info'
    )
  })

  run({ t, plan })
  await plan.completed
})

test('names the transaction off the status setting middleware', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, app } = t.nr

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
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//two',
      'should have name without post-response name info'
    )
  })

  run({
    t,
    expected: 'Accepted',
    cb: (err, res) => {
      plan.ifError(err)
      plan.equal(res.statusCode, 202, 'should not interfere with status code setting')
    },
    plan
  })
  await plan.completed
})

test('names the transaction when body set even if status set after', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { agent, app } = t.nr

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
    plan.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//two',
      'should have name without post-response name info'
    )
  })

  run({
    t,
    cb: (err, res) => {
      plan.ifError(err)
      plan.equal(res.statusCode, 202, 'should not interfere with status code setting')
    },
    plan
  })
  await plan.completed
})

test('produces transaction trace with multiple middleware', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next()
  })
  app.use(function two(ctx) {
    ctx.response.body = 'done'
  })

  agent.on('transactionFinished', (tx) => {
    checkSegments(plan, tx)
  })

  run({ t, plan })
  await plan.completed
})

test('correctly records actions interspersed among middleware', async (t) => {
  const plan = tspl(t, { plan: 17 })
  const { agent, app, testShim } = t.nr

  app.use(function one(ctx, next) {
    const parent = agent.tracer.getSegment()
    testShim.createSegment({ name: 'testSegment', parent })
    return next().then(function () {
      testShim.createSegment({ name: 'nestedSegment', parent })
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
    assertSegments(
      tx.trace,
      tx.trace.root,
      [
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
      ],
      {},
      { assert: plan }
    )
  })

  run({ t, plan })
  await plan.completed
})

test('maintains transaction state between middleware', async (t) => {
  const plan = tspl(t, { plan: 16 })
  const { agent, app } = t.nr
  let tx

  app.use(async function one(ctx, next) {
    tx = agent.getTransaction()

    await next()

    plan.ok(tx)
  })

  app.use(async function two(ctx, next) {
    plan.equal(tx.id, agent.getTransaction().id, 'two has transaction context')
    await next()
  })

  app.use(function three(ctx, next) {
    plan.equal(tx.id, agent.getTransaction().id, 'three has transaction context')
    return new Promise((resolve) => {
      setImmediate(() => {
        next().then(() => {
          plan.equal(
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
    plan.equal(tx.id, agent.getTransaction().id, 'four has transaction context')
    ctx.body = 'done'
  })

  agent.on('transactionFinished', function (txn) {
    assertSegments(
      tx.trace,
      tx.trace.root,
      [
        txn.name,
        [
          'Nodejs/Middleware/Koa/one',
          [
            'Nodejs/Middleware/Koa/two',
            ['Nodejs/Middleware/Koa/three', ['Nodejs/Middleware/Koa/four']]
          ]
        ]
      ],
      {},
      { assert: plan }
    )
  })

  run({ t, plan })
  await plan.completed
})

test('errors handled within middleware are not recorded', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next().catch(function (err) {
      plan.equal(err.message, 'middleware error', 'caught expected error')
      ctx.status = 200
      ctx.body = 'handled error'
    })
  })
  app.use(function two(ctx) {
    ctx.body = 'done'
    throw new Error('middleware error')
  })

  agent.on('transactionFinished', (tx) => {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 0, 'no errors are recorded')
    checkSegments(plan, tx)
  })

  run({ t, expected: 'handled error', plan })
  await plan.completed
})

test('errors not handled by middleware are recorded', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next().catch(function (err) {
      plan.equal(err.message, 'middleware error', 'caught expected error')
      ctx.status = 500
      ctx.body = 'error is not actually handled'
    })
  })
  app.use(function two() {
    throw new Error('middleware error')
  })

  agent.on('transactionFinished', (tx) => {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 1, 'recorded expected number of errors')
    const error = errors[0][2]
    plan.equal(error, 'middleware error', 'recorded expected error')
    checkSegments(plan, tx)
  })

  run({ t, expected: 'error is not actually handled', plan })
  await plan.completed
})

test('errors caught by default error listener are recorded', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, app } = t.nr

  app.use(function one(ctx, next) {
    return next()
  })
  app.use(function two() {
    throw new Error('middleware error')
  })
  app.on('error', function (err) {
    plan.equal(err.message, 'middleware error', 'caught expected error')
  })

  agent.on('transactionFinished', (tx) => {
    const errors = agent.errors.traceAggregator.errors
    plan.equal(errors.length, 1, 'recorded expected number of errors')
    const error = errors[0][2]
    plan.equal(error, 'middleware error', 'recorded expected error')
    checkSegments(plan, tx)
  })

  run({ t, expected: 'Internal Server Error', plan })
  await plan.completed
})
