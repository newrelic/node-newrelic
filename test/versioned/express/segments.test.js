/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { makeRequest, setup, teardown } = require('./utils')
const NAMES = require('../../../lib/metrics/names')
const { findSegment } = require('../../lib/metrics_helper')
const { assertMetrics, assertSegments, assertCLMAttrs, assertSpanKind } = require('../../lib/custom-assertions')

const assertSegmentsOptions = {
  exact: true,
  // the query and expressInit middleware are registered under the hood up until express 5
  exclude: [
    NAMES.EXPRESS.MIDDLEWARE + 'query',
    NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
  ]
}

test.beforeEach(async (ctx) => {
  await setup(ctx)
})

test.afterEach(teardown)

test('first two segments are built-in Express middlewares', function (t, end) {
  const { app } = t.nr

  app.all('/test', function (req, res) {
    res.end()
  })

  runTest(t, function (root, transaction) {
    // TODO: check for different HTTP methods
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    end()
  })
})

test('middleware with child segment gets named correctly', function (t, end) {
  const { app } = t.nr

  app.all('/test', function (req, res) {
    setTimeout(function () {
      res.end()
    }, 1)
  })

  runTest(t, function (root, transaction) {
    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    end()
  })
})

test('segments for route handler', function (t, end) {
  const { app } = t.nr

  app.all('/test', function (req, res) {
    res.end()
  })

  runTest(t, function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    end()
  })
})

test('route function names are in segment names', function (t, end) {
  const { app } = t.nr

  app.all('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])

    end()
  })
})

test('middleware mounted on a path should produce correct names', function (t, end) {
  const { app } = t.nr

  app.use('/test/:id', function handler(req, res) {
    res.send()
  })

  runTest(t, '/test/1', function (root, transaction) {
    const segment = findSegment(
      transaction.trace,
      root,
      NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'
    )
    assert.ok(segment)

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'], '/test/:id')

    end()
  })
})

test('each handler in route has its own segment', function (t, end) {
  const { app } = t.nr

  app.all(
    '/test',
    function handler1(req, res, next) {
      next()
    },
    function handler2(req, res) {
      res.send()
    }
  )

  runTest(t, function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      [
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + 'handler1', NAMES.EXPRESS.MIDDLEWARE + 'handler2']
      ],
      assertSegmentsOptions
    )
    assertSpanKind({
      agent: transaction.agent,
      segments: [
        { name: transaction.name, kind: 'server' },
        { name: 'Expressjs/Route Path: /test', kind: 'internal' },
        { name: NAMES.EXPRESS.MIDDLEWARE + 'handler1', kind: 'internal' },
        { name: NAMES.EXPRESS.MIDDLEWARE + 'handler2', kind: 'internal' },
      ]
    })

    checkMetrics(transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'handler1//test',
      NAMES.EXPRESS.MIDDLEWARE + 'handler2//test'
    ])

    end()
  })
})

test('segments for routers', function (t, end) {
  const { app, express } = t.nr

  const router = express.Router()
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
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

    end()
  })
})

test('two root routers', function (t, end) {
  const { app, express } = t.nr

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

  runTest(t, '/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      [
        'Expressjs/Router: /',
        'Expressjs/Router: /',
        ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]
      ],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'], '/test')

    end()
  })
})

test('router mounted as a route handler', function (t, end) {
  const { app, express, isExpress5 } = t.nr

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

  runTest(t, '/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
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

    end()
  })
})

test('segments for routers', function (t, end) {
  const { app, express } = t.nr

  const router = express.Router()
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
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

    end()
  })
})

test('segments for sub-app', function (t, end) {
  const { app, express } = t.nr

  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Mounted App: /subapp1', ['Expressjs/Route Path: /test', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
      assertSegmentsOptions
    )

    checkMetrics(
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/test'],
      '/subapp1/test'
    )

    end()
  })
})

test('segments for sub-app router', function (t, end) {
  const { app, express } = t.nr

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

  runTest(t, '/subapp1/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      [
        'Expressjs/Mounted App: /subapp1',
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

    end()
  })
})

test('segments for wildcard', function (t, end) {
  const { app, express } = t.nr

  const subapp = express()
  subapp.all('/:app', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Mounted App: /subapp1', ['Expressjs/Route Path: /:app', [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']]],
      assertSegmentsOptions
    )

    checkMetrics(
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//subapp1/:app'],
      '/subapp1/:app'
    )

    end()
  })
})

test('router with subapp', function (t, end) {
  const { app, express, isExpress5 } = t.nr

  const router = express.Router()
  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })
  router.use('/subapp1', subapp)
  app.use('/router1', router)

  runTest(t, '/router1/subapp1/test', function (root, transaction) {
    // express 5 no longer handles child routers as mounted applications
    const subAppSegment = isExpress5
      ? NAMES.EXPRESS.MIDDLEWARE + 'app//subapp1'
      : 'Expressjs/Mounted App: /subapp1'

    assertSegments(
      transaction.trace,
      root,
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

    end()
  })
})

test('mounted middleware', function (t, end) {
  const { app } = t.nr

  app.use('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])

    end()
  })
})

test('error middleware', function (t, end) {
  const { app } = t.nr

  app.get('/test', function () {
    throw new Error('some error')
  })

  app.use(function myErrorHandler(err, req, res, next) { // eslint-disable-line
    res.end()
  })

  runTest(t, function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
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

    end()
  })
})

test('error handler in router', function (t, end) {
  const { app, express } = t.nr

  const router = express.Router()

  router.get('/test', function () {
    throw new Error('some error')
  })

  router.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  app.use('/router', router)

  const endpoint = '/router/test'

  runTest(
    t,
    {
      endpoint,
      errors: 0
    },
    function (root, transaction) {
      assertSegments(
        transaction.trace,
        root,
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

      end()
    }
  )
})

test('error handler in second router', function (t, end) {
  const { app, express } = t.nr

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

  runTest(
    t,
    {
      endpoint,
      errors: 0
    },
    function (root, transaction) {
      assertSegments(
        transaction.trace,
        root,
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

      end()
    }
  )
})

test('error handler outside of router', function (t, end) {
  const { app, express } = t.nr

  const router = express.Router()

  router.get('/test', function () {
    throw new Error('some error')
  })

  app.use('/router', router)
  app.use(function myErrorHandler(error, req, res, next) { // eslint-disable-line
    res.end()
  })

  const endpoint = '/router/test'

  runTest(
    t,
    {
      endpoint,
      errors: 0
    },
    function (root, transaction) {
      assertSegments(
        transaction.trace,
        root,
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

      end()
    }
  )
})

test('error handler outside of two routers', function (t, end) {
  const { app, express } = t.nr

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

  runTest(
    t,
    {
      endpoint,
      errors: 0
    },
    function (root, transaction) {
      assertSegments(
        transaction.trace,
        root,
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

      end()
    }
  )
})

test('when using a route variable', function (t, end) {
  const { app } = t.nr

  app.get('/:foo/:bar', function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a/b', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: /:foo/:bar', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//:foo/:bar'],
      '/:foo/:bar'
    )

    end()
  })
})

test('when using a string pattern in path', function (t, end) {
  const { app } = t.nr

  const path = t.nr.isExpress5 ? /ab?cd/ : '/ab?cd'
  const metricPath = '/ab?cd'
  app.get(path, function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/abcd', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: ' + path, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler/' + metricPath], metricPath)

    end()
  })
})

test('when using a regular expression in path', function (t, end) {
  const { app } = t.nr

  app.get(/a/, function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a', function (root, transaction) {
    assertSegments(
      transaction.trace,
      root,
      ['Expressjs/Route Path: /a/', [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']],
      assertSegmentsOptions
    )

    checkMetrics(transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//a'], '/a')

    end()
  })
})

const codeLevelMetrics = [true, false]
for (const enabled of codeLevelMetrics) {
  test(`Code Level Metrics ${enabled}`, function (t, end) {
    const { app, agent } = t.nr
    agent.config.code_level_metrics.enabled = enabled

    function mw1(req, res, next) {
      next()
    }

    function mw2(req, res, next) {
      next()
    }

    app.get('/chained', mw1, mw2, function (req, res) {
      res.end()
    })

    runTest(t, '/chained', function (root, transaction) {
      const routeSegment = findSegment(
        transaction.trace,
        transaction.trace.root,
        'Expressjs/Route Path: /chained'
      )
      const [mw1Segment, mw2Segment, handlerSegment] = transaction.trace.getChildren(
        routeSegment.id
      )
      const defaultPath = 'test/versioned/express/segments.test.js'
      assertCLMAttrs({
        segments: [
          {
            segment: mw1Segment,
            name: 'mw1',
            filepath: defaultPath
          },
          {
            segment: mw2Segment,
            name: 'mw2',
            filepath: defaultPath
          },
          {
            segment: handlerSegment,
            name: '(anonymous)',
            filepath: defaultPath
          }
        ],
        enabled
      })
      end()
    })
  })
}

function runTest(t, options, callback) {
  const { agent, port } = t.nr
  let errors
  let endpoint

  if (options instanceof Function) {
    callback = options
    endpoint = '/test'
    errors = 0
  } else if (typeof options === 'string') {
    endpoint = options
    errors = 0
  } else {
    endpoint = options.endpoint || '/test'
    errors = options.errors || 0
  }

  agent.on('transactionFinished', function (tx) {
    const [baseSegment] = tx.trace.getChildren(tx.trace.root.id)

    assert.equal(agent.errors.traceAggregator.errors.length, errors, 'should have errors')

    callback(baseSegment, tx)
  })

  makeRequest(port, endpoint, function (response) {
    response.resume()
  })
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
