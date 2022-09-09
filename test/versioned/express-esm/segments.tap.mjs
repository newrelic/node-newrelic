/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import helper from '../../lib/agent_helper.js'
import NAMES from '../../../lib/metrics/names.js'
import { assertMetrics, assertSegments } from '../../lib/metrics_helper.js'
import { test } from 'tap'
import expressHelpers from './helpers.mjs'
const { setup, makeRequestAndFinishTransaction } = expressHelpers

const assertSegmentsOptions = {
  exact: true
}

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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
      ],
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
      ],
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])
  })

  t.test('middleware mounted on a path should produce correct names', async function (t) {
    const { app } = await setup()

    app.use('/test/:id', function handler(req, res) {
      res.send()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/test/1' })
    const routeSegment = rootSegment.children[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id')

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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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

    app.get('*', router1)

    const { rootSegment, transaction } = await runTest({ app, t })
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /*',
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
      [NAMES.EXPRESS.MIDDLEWARE + 'testHandler//*/test'],
      '/*/test'
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Mounted App: /subapp1',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'query',
          NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
          'Expressjs/Route Path: /test',
          [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
        ]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'
      ],
      '/subapp1/test'
    )
  })

  t.test('segments for sub-app', async function (t) {
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Mounted App: /subapp1',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'query',
          NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'
      ],
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Mounted App: /subapp1',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'query',
          NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
          'Expressjs/Route Path: /:app',
          [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
        ]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1',
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/:app'
      ],
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Router: /router1',
        [
          'Expressjs/Mounted App: /subapp1',
          [
            NAMES.EXPRESS.MIDDLEWARE + 'query',
            NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
            'Expressjs/Route Path: /test',
            [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
          ]
        ]
      ],
      assertSegmentsOptions
    )

    checkMetrics(
      t,
      transaction.metrics,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query//router1/subapp1',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit//router1/subapp1',
        NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//router1/subapp1/test'
      ],
      '/router1/subapp1/test'
    )
  })

  t.test('mounted middleware', async function (t) {
    const { app } = await setup()

    app.use('/test', function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t })
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'
      ],
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
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
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /:foo/:bar',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
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

    app.get('/ab?cd', function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/abcd' })
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /ab?cd',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//ab?cd'], '/ab?cd')
  })

  t.test('when using a regular expression in path', async function (t) {
    const { app } = await setup()

    app.get(/a/, function myHandler(req, res) {
      res.end()
    })

    const { rootSegment, transaction } = await runTest({ app, t, endpoint: '/a' })
    checkSegments(
      t,
      rootSegment,
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /a/',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
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

function checkSegments(t, segments, expected, opts) {
  t.doesNotThrow(function () {
    assertSegments(segments, expected, opts)
  }, 'should have expected segments')
}

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
    [{ name: 'Apdex' }],
    [{ name: NAMES.EXPRESS.MIDDLEWARE + 'query//' }],
    [{ name: NAMES.EXPRESS.MIDDLEWARE + 'expressInit//' }],
    [{ name: NAMES.EXPRESS.MIDDLEWARE + 'query//', scope: 'WebTransaction/Expressjs/GET/' + path }],
    [
      {
        name: NAMES.EXPRESS.MIDDLEWARE + 'expressInit//',
        scope: 'WebTransaction/Expressjs/GET/' + path
      }
    ]
  ]

  for (let i = 0; i < expected.length; i++) {
    const metric = expected[i]
    expectedAll.push([{ name: metric }])
    expectedAll.push([{ name: metric, scope: 'WebTransaction/Expressjs/GET/' + path }])
  }

  assertMetrics(metrics, expectedAll, true, false)
}
