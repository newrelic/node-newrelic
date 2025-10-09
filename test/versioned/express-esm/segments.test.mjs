/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import semver from 'semver'

import assertions from '../../lib/custom-assertions/index.js'
const { assertMetrics, assertSegments } = assertions

import helper from '../../lib/agent_helper.js'
import expressHelpers from './helpers.mjs'
import NAMES from '../../../lib/metrics/names.js'
import { findSegment } from '../../lib/metrics_helper.js'

// import expressPkg from 'express/package.json' assert {type: 'json'}
// const pkgVersion = expressPkg.version
import { readFileSync } from 'node:fs'
const { version: pkgVersion } = JSON.parse(readFileSync('./node_modules/express/package.json'))
const isExpress5 = semver.gte(pkgVersion, '5.0.0')

const { setup, makeRequestAndFinishTransaction } = expressHelpers
const assertSegmentsOptions = {
  exact: true,
  // in Node 8 the http module sometimes creates a setTimeout segment
  // the query and expressInit middleware are registered under the hood up until express 5
  exclude: [NAMES.EXPRESS.MIDDLEWARE + 'query', NAMES.EXPRESS.MIDDLEWARE + 'expressInit']
}

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

test('first two segments are built-in Express middleware', async (t) => {
  const { agent, app, server } = t.nr
  app.all('/test', (req, res) => {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
    assertSegmentsOptions
  )
  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
})

test('middleware with child segment gets named correctly', async (t) => {
  const { agent, app, server } = t.nr

  app.all('/test', function (req, res) {
    setTimeout(function () {
      res.end()
    }, 1)
  })

  const { transaction } = await runTest({ agent, server })
  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
})

test('segments for route handler', async (t) => {
  const { agent, app, server } = t.nr

  app.all('/test', function (req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
})

test('route function names are in segment names', async (t) => {
  const { agent, app, server } = t.nr

  app.all('/test', function myHandler(req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])
})

test('middleware mounted on a path should produce correct names', async (t) => {
  const { agent, app, server } = t.nr

  app.use('/test/:id', function handler(req, res) {
    res.send()
  })

  const { transaction } = await runTest({ agent, server, endpoint: '/test/1' })
  const routeSegment = findSegment(
    transaction.trace,
    transaction.trace.root,
    NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'
  )
  assert.ok(routeSegment)

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'], '/test/:id')
})

test('each handler in route has its own segment', async (t) => {
  const { agent, app, server } = t.nr

  app.all(
    '/test',
    function handler1(req, res, next) {
      next()
    },
    function handler2(req, res) {
      res.send()
    }
  )

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Route Path: /test',
      [NAMES.EXPRESS.MIDDLEWARE + 'handler1', NAMES.EXPRESS.MIDDLEWARE + 'handler2']
    ],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [
    NAMES.EXPRESS.MIDDLEWARE + 'handler1//test',
    NAMES.EXPRESS.MIDDLEWARE + 'handler2//test'
  ])
})

test('segments for routers', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/router1/test' })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router1',
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/test'],
    '/router1/test'
  )
})

test('two root routers', async (t) => {
  const { agent, app, express, server } = t.nr

  const router1 = express.Router()
  router1.all('/', function (req, res) {
    res.end()
  })
  app.use('/', router1)

  const router2 = express.Router()
  router2.all('/test', function (req, res) {
    res.end()
  })
  app.use('/', router2)

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /',
      'Expressjs/Router: /',
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
    ],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'], '/test')
})

test('router mounted as a route handler', async (t) => {
  const { agent, app, express, server } = t.nr

  const router1 = express.Router()
  router1.all('/test', function testHandler(req, res) {
    res.send('test')
  })

  let path = '*'
  let segmentPath = path
  let metricsPath = '/*'

  // express 5 router must be regular expressions
  // need to handle the nuance of the segment vs metric name in express 5
  if (isExpress5) {
    path = /(.*)/
    segmentPath = '/(.*)/'
    metricsPath = '/(.*)'
  }

  app.get(path, router1)

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      `Expressjs/Route Path: ${segmentPath}`,
      [
        'Expressjs/Router: /',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + 'testHandler']]
      ]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [`${NAMES.EXPRESS.MIDDLEWARE}testHandler/${metricsPath}/test`],
    `${metricsPath}/test`
  )
})

test('segments for routers', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/router1/test' })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router1',
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/test'],
    '/router1/test'
  )
})

test('segments for sub-app', async (t) => {
  const { agent, app, express, server } = t.nr

  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/subapp1/test' })
  const firstSegment = 'Expressjs/Mounted App: /subapp1'

  assertSegments(
    transaction.trace,
    rootSegment,
    [firstSegment, ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'],
    '/subapp1/test'
  )
})

test('segments for sub-app router', async (t) => {
  const { agent, app, express, server } = t.nr

  const subapp = express()
  subapp.get(
    '/test',
    function (req, res, next) {
      next()
    },
    function (req, res, next) {
      next()
    }
  )
  subapp.get('/test', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/subapp1/test' })
  const firstSegment = 'Expressjs/Mounted App: /subapp1'

  assertSegments(
    transaction.trace,
    rootSegment,
    [
      firstSegment,
      [
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>', NAMES.EXPRESS.MIDDLEWARE + '<anonymous>'],
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
      ]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'],
    '/subapp1/test'
  )
})

test('segments for wildcard', async (t) => {
  const { agent, app, express, server } = t.nr

  const subapp = express()
  subapp.all('/:app', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/subapp1/test' })
  const firstSegment = 'Expressjs/Mounted App: /subapp1'

  assertSegments(
    transaction.trace,
    rootSegment,
    [firstSegment, ['Expressjs/Route Path: /:app', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/:app'],
    '/subapp1/:app'
  )
})

test('router with subapp', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()
  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })
  router.use('/subapp1', subapp)
  app.use('/router1', router)

  const { rootSegment, transaction } = await runTest({
    agent,
    server,
    endpoint: '/router1/subapp1/test'
  })
  // express 5 no longer handles child routers as mounted applications
  const subAppSegment = isExpress5
    ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
    : 'Expressjs/Mounted App: /subapp1'

  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router1',
      [subAppSegment, ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/subapp1/test'],
    '/router1/subapp1/test'
  )
})

test('mounted middleware', async (t) => {
  const { agent, app, server } = t.nr

  app.use('/test', function myHandler(req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])
})

test('error middleware', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/test', function () {
    throw new Error('some error')
  })

  app.use(function myErrorHandler(err, req, res, next) { // eslint-disable-line
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Route Path: /test',
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>'],
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [
      NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//test'
    ],
    '/test'
  )
})

test('error handler in router', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()

  router.get('/test', function () {
    throw new Error('some error')
  })

  router.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  app.use('/router', router)

  const endpoint = '/router/test'

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router',
      [
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>'],
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
      ]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [
      NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router/test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router/test'
    ],
    endpoint
  )
})

test('error handler in second router', async (t) => {
  const { agent, app, express, server } = t.nr

  const router1 = express.Router()
  const router2 = express.Router()

  router2.get('/test', function () {
    throw new Error('some error')
  })

  router2.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  router1.use('/router2', router2)
  app.use('/router1', router1)

  const endpoint = '/router1/router2/test'

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router1',
      [
        'Expressjs/Router: /router2',
        [
          'Expressjs/Route Path: /test',
          [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>'],
          NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
        ]
      ]
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [
      NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/router2/test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router1/router2/test'
    ],
    endpoint
  )
})

test('error handler outside of router', async (t) => {
  const { agent, app, express, server } = t.nr

  const router = express.Router()

  router.get('/test', function () {
    throw new Error('some error')
  })

  app.use('/router', router)
  app.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  const endpoint = '/router/test'

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router',
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [
      NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router/test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router/test'
    ],
    endpoint
  )
})

test('error handler outside of two routers', async (t) => {
  const { agent, app, express, server } = t.nr

  const router1 = express.Router()
  const router2 = express.Router()

  router1.use('/router2', router2)

  router2.get('/test', function () {
    throw new Error('some error')
  })

  app.use('/router1', router1)
  app.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  const endpoint = '/router1/router2/test'

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint })
  assertSegments(
    transaction.trace,
    rootSegment,
    [
      'Expressjs/Router: /router1',
      [
        'Expressjs/Router: /router2',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
      ],
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
    ],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [
      NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/router2/test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router1/router2/test'
    ],
    endpoint
  )
})

test('when using a route variable', async (t) => {
  const { agent, app, server } = t.nr

  app.get('/:foo/:bar', function myHandler(req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/a/b' })
  assertSegments(
    transaction.trace,
    rootSegment,
    ['Expressjs/Route Path: /:foo/:bar', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
    assertSegmentsOptions
  )

  checkMetrics(
    transaction.metrics,
    [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//:foo/:bar'],
    '/:foo/:bar'
  )
})

test('when using a string pattern in path', async (t) => {
  const { agent, app, server } = t.nr

  const path = isExpress5 ? /ab?cd/ : '/ab?cd'
  const metricPath = '/ab?cd'
  app.get(path, function myHandler(req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/abcd' })
  assertSegments(
    transaction.trace,
    rootSegment,
    [`Expressjs/Route Path: ${path}`, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [`${NAMES.EXPRESS.MIDDLEWARE}myHandler/${metricPath}`], metricPath)
})

test('when using a regular expression in path', async (t) => {
  const { agent, app, server } = t.nr

  app.get(/a/, function myHandler(req, res) {
    res.end()
  })

  const { rootSegment, transaction } = await runTest({ agent, server, endpoint: '/a' })
  assertSegments(
    transaction.trace,
    rootSegment,
    ['Expressjs/Route Path: /a/', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
    assertSegmentsOptions
  )

  checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//a'], '/a')
})

async function runTest({ agent, server, endpoint = '/test', errors = 0 }) {
  const transaction = await makeRequestAndFinishTransaction({ server, agent, endpoint })
  const [rootSegment] = transaction.trace.getChildren(transaction.trace.root.id)

  assert.equal(agent.errors.traceAggregator.errors.length, errors, `should have ${errors} errors`)
  return { rootSegment, transaction }
}

function checkMetrics(metrics, expected, path) {
  if (path === undefined) {
    path = '/test'
  }
  const expectedAll = [
    [{ name: 'WebTransaction' }],
    [{ name: 'WebTransactionTotalTime' }],
    [{ name: 'HttpDispatcher' }],
    [{ name: 'WebTransaction/Expressjs/GET/' + path }],
    [{ name: 'WebTransactionTotalTime/Expressjs/GET/' + path }],
    [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' }],
    [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' }],
    [{ name: 'Apdex/Expressjs/GET/' + path }],
    [{ name: 'Apdex' }]
  ]

  for (let i = 0; i < expected.length; i++) {
    const metric = expected[i]
    expectedAll.push([{ name: metric }])
    expectedAll.push([{ name: metric, scope: 'WebTransaction/Expressjs/GET/' + path }])
  }

  assertMetrics(metrics, expectedAll, false, false)
}
