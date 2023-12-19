/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const http = require('http')
const NAMES = require('../../../lib/metrics/names')
require('../../lib/metrics_helper')
const tap = require('tap')
const { test } = tap

let express
let agent
let app

const assertSegmentsOptions = {
  exact: true,
  // in Node 8 the http module sometimes creates a setTimeout segment
  exclude: ['timers.setTimeout', 'Truncated/timers.setTimeout']
}

test('first two segments are built-in Express middlewares', function (t) {
  setup(t)

  app.all('/test', function (req, res) {
    res.end()
  })

  runTest(t, function (segments, transaction) {
    // TODO: check for different HTTP methods
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    t.end()
  })
})

test('middleware with child segment gets named correctly', function (t) {
  setup(t)

  app.all('/test', function (req, res) {
    setTimeout(function () {
      res.end()
    }, 1)
  })

  runTest(t, function (segments, transaction) {
    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    t.end()
  })
})

test('segments for route handler', function (t) {
  setup(t)

  app.all('/test', function (req, res) {
    res.end()
  })

  runTest(t, function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + '<anonymous>//test'])

    t.end()
  })
})

test('route function names are in segment names', function (t) {
  setup(t)

  app.all('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])

    t.end()
  })
})

test('middleware mounted on a path should produce correct names', function (t) {
  setup(t)

  app.use('/test/:id', function handler(req, res) {
    res.send()
  })

  runTest(t, '/test/1', function (segments, transaction) {
    const routeSegment = segments[2]
    t.equal(routeSegment.name, NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id')

    checkMetrics(
      t,
      transaction.metrics,
      [NAMES.EXPRESS.MIDDLEWARE + 'handler//test/:id'],
      '/test/:id'
    )

    t.end()
  })
})

test('each handler in route has its own segment', function (t) {
  setup(t)

  app.all(
    '/test',
    function handler1(req, res, next) {
      next()
    },
    function handler2(req, res) {
      res.send()
    }
  )

  runTest(t, function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('segments for routers', function (t) {
  setup(t)

  const router = express.Router() // eslint-disable-line new-cap
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('two root routers', function (t) {
  setup(t)

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

  runTest(t, '/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('router mounted as a route handler', function (t) {
  setup(t)

  const router1 = express.Router() // eslint-disable-line new-cap
  router1.all('/test', function testHandler(req, res) {
    res.send('test')
  })

  app.get('*', router1)

  runTest(t, '/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('segments for routers', function (t) {
  setup(t)

  const router = express.Router() // eslint-disable-line new-cap
  router.all('/test', function (req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('segments for sub-app', function (t) {
  setup(t)

  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('segments for sub-app', function (t) {
  setup(t)

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

  runTest(t, '/subapp1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('segments for wildcard', function (t) {
  setup(t)

  const subapp = express()
  subapp.all('/:app', function (req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('router with subapp', function (t) {
  setup(t)

  const router = express.Router() // eslint-disable-line new-cap
  const subapp = express()
  subapp.all('/test', function (req, res) {
    res.end()
  })
  router.use('/subapp1', subapp)
  app.use('/router1', router)

  runTest(t, '/router1/subapp1/test', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('mounted middleware', function (t) {
  setup(t)

  app.use('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'])

    t.end()
  })
})

test('error middleware', function (t) {
  setup(t)

  app.get('/test', function () {
    throw new Error('some error')
  })

  app.use(function myErrorHandler(err, req, res, next) { // eslint-disable-line
    res.end()
  })

  runTest(t, function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('error handler in router', function (t) {
  setup(t)

  const router = express.Router() // eslint-disable-line new-cap

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
      endpoint: endpoint,
      errors: 0
    },
    function (segments, transaction) {
      checkSegments(
        t,
        transaction.trace.root.children[0],
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

      t.end()
    }
  )
})

test('error handler in second router', function (t) {
  setup(t)

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

  runTest(
    t,
    {
      endpoint: endpoint,
      errors: 0
    },
    function (segments, transaction) {
      checkSegments(
        t,
        transaction.trace.root.children[0],
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

      t.end()
    }
  )
})

test('error handler outside of router', function (t) {
  setup(t)

  const router = express.Router() // eslint-disable-line new-cap

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
      endpoint: endpoint,
      errors: 0
    },
    function (segments, transaction) {
      checkSegments(
        t,
        transaction.trace.root.children[0],
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

      t.end()
    }
  )
})

test('error handler outside of two routers', function (t) {
  setup(t)

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

  runTest(
    t,
    {
      endpoint: endpoint,
      errors: 0
    },
    function (segments, transaction) {
      checkSegments(
        t,
        transaction.trace.root.children[0],
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

      t.end()
    }
  )
})

test('when using a route variable', function (t) {
  setup(t)

  app.get('/:foo/:bar', function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a/b', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
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

    t.end()
  })
})

test('when using a string pattern in path', function (t) {
  setup(t)

  app.get('/ab?cd', function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/abcd', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /ab?cd',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//ab?cd'], '/ab?cd')

    t.end()
  })
})

test('when using a regular expression in path', function (t) {
  setup(t)

  app.get(/a/, function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a', function (segments, transaction) {
    checkSegments(
      t,
      transaction.trace.root.children[0],
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /a/',
        [NAMES.EXPRESS.MIDDLEWARE + 'myHandler']
      ],
      assertSegmentsOptions
    )

    checkMetrics(t, transaction.metrics, [NAMES.EXPRESS.MIDDLEWARE + 'myHandler//a/'], '/a/')

    t.end()
  })
})

const codeLevelMetrics = [true, false]
codeLevelMetrics.forEach((enabled) => {
  test(`Code Level Metrics ${enabled}`, function (t) {
    setup(t, { code_level_metrics: { enabled } })

    function mw1(req, res, next) {
      next()
    }

    function mw2(req, res, next) {
      next()
    }

    app.get('/chained', mw1, mw2, function (req, res) {
      res.end()
    })

    runTest(t, '/chained', function (segments) {
      const [querySegment, initSegment, routeSegment] = segments
      const [mw1Segment, mw2Segment, handlerSegment] = routeSegment.children
      const defaultPath = 'test/versioned/express/segments.tap.js'
      t.clmAttrs({
        segments: [
          {
            segment: querySegment,
            name: 'query',
            filepath: 'express/lib/middleware/query.js'
          },
          {
            segment: initSegment,
            name: 'expressInit',
            filepath: 'express/lib/middleware/init.js'
          },
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
      t.end()
    })
  })
})

function setup(t, config = {}) {
  agent = helper.instrumentMockedAgent(config)

  express = require('express')
  app = express()
  t.teardown(() => {
    helper.unloadAgent(agent)
  })
}

function runTest(t, options, callback) {
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
    const baseSegment = tx.trace.root.children[0]

    t.equal(agent.errors.traceAggregator.errors.length, errors, 'should have errors')

    callback(baseSegment.children, tx)
  })

  const server = app.listen(function () {
    makeRequest(this, endpoint, function (response) {
      response.resume()
    })
  })

  t.teardown(() => {
    server.close()
  })
}

function makeRequest(server, path, callback) {
  const port = server.address().port
  http.request({ port: port, path: path }, callback).end()
}

function checkSegments(t, segments, expected, opts) {
  t.assertSegments(segments, expected, opts)
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

  t.assertMetrics(metrics, expectedAll, true, false)
}
