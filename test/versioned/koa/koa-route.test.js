/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { run } = require('./utils')
const assertSegments = require('../../lib/custom-assertions/assert-segments')
const helper = require('../../lib/agent_helper')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const Koa = require('koa')
  ctx.nr.app = new Koa()
  ctx.nr.route = require('koa-route')
})

test.afterEach((ctx) => {
  removeModules(['koa', 'koa-router'])
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

test('should name and produce segments for koa-route middleware', (t, end) => {
  const { agent, app, route } = t.nr
  const first = route.get('/resource', function firstMiddleware(ctx) {
    ctx.body = 'hello'
  })
  app.use(first)
  agent.on('transactionFinished', function (tx) {
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//resource',
      ['Nodejs/Middleware/Koa/firstMiddleware//resource']
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//resource',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ path: '/resource', context: t.nr })
})

test('should name the transaction after the last responder', (t, end) => {
  const { agent, app, route } = t.nr
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
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//:second',
      [
        'Nodejs/Middleware/Koa/firstMiddleware//:first',
        ['Nodejs/Middleware/Koa/secondMiddleware//:second']
      ]
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//:second',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ context: t.nr })
})

test('should name the transaction properly when responding after next', (t, end) => {
  const { agent, app, route } = t.nr
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
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//:first',
      [
        'Nodejs/Middleware/Koa/firstMiddleware//:first',
        ['Nodejs/Middleware/Koa/secondMiddleware//:second']
      ]
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//:first',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ context: t.nr })
})

test('should work with early responding', (t, end) => {
  const { agent, app, route } = t.nr
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
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//:first',
      ['Nodejs/Middleware/Koa/firstMiddleware//:first']
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//:first',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ context: t.nr })
})

test('should name the transaction after the source of the error that occurred', (t, end) => {
  const { agent, app, route } = t.nr
  const first = route.get('/:first', function firstMiddleware(ctx, param, next) {
    return next()
  })
  const second = route.get('/:second', function secondMiddleware() {
    throw Error('some error')
  })
  app.silent = true
  app.use(first)
  app.use(second)
  agent.on('transactionFinished', function (tx) {
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//:second',
      [
        'Nodejs/Middleware/Koa/firstMiddleware//:first',
        ['Nodejs/Middleware/Koa/secondMiddleware//:second']
      ]
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//:second',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ context: t.nr })
})

test('should work properly when used along with non-route middleware', (t, end) => {
  const { agent, app, route } = t.nr
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
    assertSegments(tx.trace.root, [
      'WebTransaction/WebFrameworkUri/Koa/GET//resource',
      [
        'Nodejs/Middleware/Koa/firstMiddleware',
        [
          'Nodejs/Middleware/Koa/secondMiddleware//resource',
          ['Nodejs/Middleware/Koa/thirdMiddleware']
        ]
      ]
    ])
    assert.equal(
      tx.name,
      'WebTransaction/WebFrameworkUri/Koa/GET//resource',
      'transaction should be named after the middleware responsible for responding'
    )
    end()
  })
  run({ path: '/resource', context: t.nr })
})
