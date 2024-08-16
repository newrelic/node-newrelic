/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver'
import helper from '../../lib/agent_helper.js'
import NAMES from '../../../lib/metrics/names.js'
import { findSegment } from '../../lib/metrics_helper.js'
import { test } from 'tap'
import expressHelpers from './helpers.mjs'
const { setup, makeRequestAndFinishTransaction } = expressHelpers
const assertSegmentsOptions = {
  exact: true,
  // in Node 8 the http module sometimes creates a setTimeout segment
  // the query and expressInit middleware are registered under the hood up until express 5
  exclude: [NAMES.EXPRESS.MIDDLEWARE + 'query', NAMES.EXPRESS.MIDDLEWARE + 'expressInit']
}
// import expressPkg from 'express/package.json' assert {type: 'json'}
// const pkgVersion = expressPkg.version
import { readFileSync } from 'node:fs'
const { version: pkgVersion } = JSON.parse(readFileSync('./node_modules/express/package.json'))
// TODO: change to 5.0.0 when officially released
const isExpress5 = semver.gte(pkgVersion, '5.0.0-beta.3')

test('transaction segments tests', (t) => {
  t.autoend()

  let agent
  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.test('first two segments are built-in Express middleware', async function (t) {
    const { app } = await setup()

    app.all('/test', function (req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
  })

  t.test('middleware with child segment gets named correctly', async function (t) {
    const { app } = await setup()

    app.all('/test', function (req, res) {
      setTimeout(function () {
        res.end()
      }, 1)
    })

    const { transaction } = await runTest({ app, t })
    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
  })

  t.test('segments for route handler', async function (t) {
    const { app } = await setup()

    app.all('/test', function (req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])
  })

  t.test('route function names are in segment names', async function (t) {
    const { app } = await setup()

    app.all('/test', function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])
  })

  t.test('middleware mounted on a path should produce correct names', async function (t) {
    const { app } = await setup()

    app.use('/test/:id', function handler(req, res) {
      res.send()
    })

    const { transaction } = await runTest({ app, t, endpoint: '/test/1' })
    const routeSegment = findSegment(
      transaction.trace.root,
      NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'
    )
    t.ok(routeSegment)

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'],
      '/test/:id'
    )
  })

  t.test('each handler in route has its own segment', async function (t) {
    const { app } = await setup()

    app.all(
      '/test',
      function handler1(req, res, next) {
        next()
      },
      function handler2(req, res) {
        res.send()
      }
    )

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + 'handler1', NAMES.EXPRESS.MIDDLEWARE + 'handler2']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'handler1//test',
      NAMES.EXPRESS.MIDDLEWARE + 'handler2//test'
    ])
  })

  t.test('segments for routers', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap
    router.all('/test', function (req, res) {
      res.end()
    })

    app.use('/router1', router)

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/router1/test' })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Router: /router1',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/test'],
      '/router1/test'
    )
  })

  t.test('two root routers', async function (t) {
    const { app, express } = await setup()

    const router1 = express.Router() // eslint-disable-line new-cap
    router1.all('/', function (req, res) {
      res.end()
    })
    app.use('/', router1)

    const router2 = express.Router() // eslint-disable-line new-cap
    router2.all('/test', function (req, res) {
      res.end()
    })
    app.use('/', router2)

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Router: /',
        'Expressjs/Router: /',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'], '/test')
  })

  t.test('router mounted as a route handler', async function (t) {
    const { app, express } = await setup()

    const router1 = express.Router() // eslint-disable-line new-cap
    router1.all('/test', function testHandler(req, res) {
      res.send('test')
    })

    const path = isExpress5 ? '(.*)' : '*'
    app.get(path, router1)

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      [
        `Expressjs/Route Path: /${path}`,
        [
          'Expressjs/Router: /',
          ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + 'testHandler']]
        ]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [`${NAMES.EXPRESS.MIDDLEWARE}testHandler//${path}/test`],
      `/${path}/test`
    )
  })

  t.test('segments for routers', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap
    router.all('/test', function (req, res) {
      res.end()
    })

    app.use('/router1', router)

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/router1/test' })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Router: /router1',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/test'],
      '/router1/test'
    )
  })

  t.test('segments for sub-app', async function (t) {
    const { app, express } = await setup()

    const subapp = express()
    subapp.all('/test', function (req, res) {
      res.end()
    })

    app.use('/subapp1', subapp)

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/subapp1/test' })
    // express 5 no longer handles child routers as mounted applications
    const firstSegment = isExpress5
      ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
      : 'Expressjs/Mounted App: /subapp1'

    t.assertSegments(
      rootSegment,
      [firstSegment, ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'],
      '/subapp1/test'
    )
  })

  t.test('segments for sub-app router', async function (t) {
    const { app, express } = await setup()

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

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/subapp1/test' })
    // express 5 no longer handles child routers as mounted applications
    const firstSegment = isExpress5
      ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
      : 'Expressjs/Mounted App: /subapp1'

    t.assertSegments(
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
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'],
      '/subapp1/test'
    )
  })

  t.test('segments for wildcard', async function (t) {
    const { app, express } = await setup()

    const subapp = express()
    subapp.all('/:app', function (req, res) {
      res.end()
    })

    app.use('/subapp1', subapp)

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/subapp1/test' })
    // express 5 no longer handles child routers as mounted applications
    const firstSegment = isExpress5
      ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
      : 'Expressjs/Mounted App: /subapp1'

    t.assertSegments(
      rootSegment,
      [firstSegment, ['Expressjs/Route Path: /:app', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/:app'],
      '/subapp1/:app'
    )
  })

  t.test('router with subapp', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap
    const subapp = express()
    subapp.all('/test', function (req, res) {
      res.end()
    })
    router.use('/subapp1', subapp)
    app.use('/router1', router)

    const { rootSegment, transaction } = await runTest({
      app,
      t,
      endpoint: '/router1/subapp1/test'
    })
    // express 5 no longer handles child routers as mounted applications
    const subAppSegment = isExpress5
      ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
      : 'Expressjs/Mounted App: /subapp1'

    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Router: /router1',
        [subAppSegment, ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/subapp1/test'],
      '/router1/subapp1/test'
    )
  })

  t.test('mounted middleware', async function (t) {
    const { app } = await setup()

    app.use('/test', function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])
  })

  t.test('error middleware', async function (t) {
    const { app } = await setup()

    app.get('/test', function () {
      throw new Error('some error')
    })

    app.use(function myErrorHandler(err, req, res, next) { // eslint-disable-line
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>'],
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test',
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//test'
      ],
      '/test'
    )
  })

  t.test('error handler in router', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap

    router.get('/test', function () {
      throw new Error('some error')
    })

    router.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
      res.end()
    })

    app.use('/router', router)

    const endpoint = '/router/test'

    const { rootSegment, transaction } = await runTest({ app, t, endpoint })
    t.assertSegments(
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
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router/test',
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router/test'
      ],
      endpoint
    )
  })

  t.test('error handler in second router', async function (t) {
    const { app, express } = await setup()

    const router1 = express.Router() // eslint-disable-line new-cap
    const router2 = express.Router() // eslint-disable-line new-cap

    router2.get('/test', function () {
      throw new Error('some error')
    })

    router2.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
      res.end()
    })

    router1.use('/router2', router2)
    app.use('/router1', router1)

    const endpoint = '/router1/router2/test'

    const { rootSegment, transaction } = await runTest({ app, t, endpoint })
    t.assertSegments(
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
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/router2/test',
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router1/router2/test'
      ],
      endpoint
    )
  })

  t.test('error handler outside of router', async function (t) {
    const { app, express } = await setup()

    const router = express.Router() // eslint-disable-line new-cap

    router.get('/test', function () {
      throw new Error('some error')
    })

    app.use('/router', router)
    app.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
      res.end()
    })

    const endpoint = '/router/test'

    const { rootSegment, transaction } = await runTest({ app, t, endpoint })
    t.assertSegments(
      rootSegment,
      [
        'Expressjs/Router: /router',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router/test',
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router/test'
      ],
      endpoint
    )
  })

  t.test('error handler outside of two routers', async function (t) {
    const { app, express } = await setup()

    const router1 = express.Router() // eslint-disable-line new-cap
    const router2 = express.Router() // eslint-disable-line new-cap

    router1.use('/router2', router2)

    router2.get('/test', function () {
      throw new Error('some error')
    })

    app.use('/router1', router1)
    app.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
      res.end()
    })

    const endpoint = '/router1/router2/test'

    const { rootSegment, transaction } = await runTest({ app, t, endpoint })
    t.assertSegments(
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
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/router2/test',
        NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler//router1/router2/test'
      ],
      endpoint
    )
  })

  t.test('when using a route variable', async function (t) {
    const { app } = await setup()

    app.get('/:foo/:bar', function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/a/b' })
    t.assertSegments(
      rootSegment,
      ['Expressjs/Route Path: /:foo/:bar', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//:foo/:bar'],
      '/:foo/:bar'
    )
  })

  t.test('when using a string pattern in path', async function (t) {
    const { app } = await setup()

    const path = isExpress5 ? /ab?cd/ : '/ab?cd'
    app.get(path, function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/abcd' })
    t.assertSegments(
      rootSegment,
      [`Expressjs/Route Path: ${path}`, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [`${NAMES.EXPRESS.MIDDLEWARE}myHandler/${path}`], path)
  })

  t.test('when using a regular expression in path', async function (t) {
    const { app } = await setup()

    app.get(/a/, function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/a' })
    t.assertSegments(
      rootSegment,
      ['Expressjs/Route Path: /a/', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//a/'], '/a/')
  })

  async function runTest({ t, app, endpoint = '/test', errors = 0 }) {
    const transaction = await makeRequestAndFinishTransaction({ t, app, agent, endpoint })
    const rootSegment = transaction.trace.root.children[0]

    t.equal(agent.errors.traceAggregator.errors.length, errors, `should have ${errors} errors`)
    return { rootSegment, transaction }
  }
})

function checkMetrics(t, metrics, expected, path) {
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

  t.assertMetrics(metrics, expectedAll, false, false)
}
