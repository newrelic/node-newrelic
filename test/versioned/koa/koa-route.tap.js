/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
const { run } = require('./utils')

tap.test('koa-route instrumentation', function (t) {
  t.beforeEach(function (t) {
    t.context.agent = helper.instrumentMockedAgent()
    const Koa = require('koa')
    t.context.app = new Koa()
    t.context.route = require('koa-route')
  })

  t.afterEach(function (t) {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('should name and produce segments for koa-route middleware', function (t) {
    const { agent, app, route } = t.context
    const first = route.get('/resource', function firstMiddleware(ctx) {
      ctx.body = 'hello'
    })
    app.use(first)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        ['Nodejs/Middleware/Koa/firstMiddleware//resource']
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ path: '/resource', context: t.context })
  })

  t.test('should name the transaction after the last responder', function (t) {
    const { agent, app, route } = t.context
    const first = route.get('/:first', function firstMiddleware(ctx, param, next) {
      ctx.body = 'first'
      return next()
    })
    const second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        [
          'Nodejs/Middleware/Koa/firstMiddleware//:first',
          ['Nodejs/Middleware/Koa/secondMiddleware//:second']
        ]
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ context: t.context })
  })

  t.test('should name the transaction properly when responding after next', function (t) {
    const { agent, app, route } = t.context
    const first = route.get('/:first', function firstMiddleware(ctx, param, next) {
      return next().then(function respond() {
        ctx.body = 'first'
      })
    })
    const second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        [
          'Nodejs/Middleware/Koa/firstMiddleware//:first',
          ['Nodejs/Middleware/Koa/secondMiddleware//:second']
        ]
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ context: t.context })
  })

  t.test('should work with early responding', function (t) {
    const { agent, app, route } = t.context
    const first = route.get('/:first', function firstMiddleware(ctx) {
      ctx.body = 'first'
      return Promise.resolve()
    })
    const second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        ['Nodejs/Middleware/Koa/firstMiddleware//:first']
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ context: t.context })
  })

  t.test('should name the transaction after the source of the error that occurred', function (t) {
    const { agent, app, route } = t.context
    const first = route.get('/:first', function firstMiddleware(ctx, param, next) {
      return next()
    })
    const second = route.get('/:second', function secondMiddleware() {
      throw new Error('some error')
    })
    app.use(first)
    app.use(second)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        [
          'Nodejs/Middleware/Koa/firstMiddleware//:first',
          ['Nodejs/Middleware/Koa/secondMiddleware//:second']
        ]
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ context: t.context })
  })

  t.test('should work properly when used along with non-route middleware', function (t) {
    const { agent, app, route } = t.context
    const first = function firstMiddleware(ctx, next) {
      return next()
    }
    const second = route.get('/resource', function secondMiddleware(ctx, next) {
      ctx.body = 'hello'
      return next()
    })
    const third = function thirdMiddleware(ctx, next) {
      return next()
    }
    app.use(first)
    app.use(second)
    app.use(third)
    agent.on('transactionFinished', function (tx) {
      t.assertSegments(tx.trace.root, [
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        [
          'Nodejs/Middleware/Koa/firstMiddleware',
          [
            'Nodejs/Middleware/Koa/secondMiddleware//resource',
            ['Nodejs/Middleware/Koa/thirdMiddleware']
          ]
        ]
      ])
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run({ path: '/resource', context: t.context })
  })

  t.end()
})
