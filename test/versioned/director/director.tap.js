/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const http = require('http')
const helper = require('../../lib/agent_helper')

tap.test('basic director test', function (t) {
  let server = null
  const agent = helper.instrumentMockedAgent()

  const director = require('director')

  function fn0() {
    t.ok(agent.getTransaction(), 'transaction is available')
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }
  function fn1() {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }

  const routes = {
    '/hello': {
      'get': fn0,
      '/(\\w+)/': {
        get: fn1
      }
    }
  }

  const router = new director.http.Router(routes).configure({ recurse: 'forward' })

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close(function () {})
  })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Director/GET//hello', 'transaction has expected name')

    t.equal(transaction.url, '/hello/eric', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, 'GET', 'HTTP method is GET')
    t.ok(transaction.trace, 'transaction has trace')

    const web = transaction.trace.root.children[0]
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')

    t.equal(web.partialName, 'Director/GET//hello', 'should have partial name for apdex')

    const handler0 = web.children[0]
    t.equal(
      handler0.name,
      'Nodejs/Middleware/Director/fn0//hello',
      'route 0 segment has correct name'
    )

    const handler1 = web.children[1]
    t.equal(
      handler1.name,
      'Nodejs/Middleware/Director/fn1//hello/(\\w+)/',
      'route 1 segment has correct name'
    )
  })

  server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const url = 'http://localhost:' + port + '/hello/eric'
      helper.makeGetRequest(url, { json: true }, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })
})

tap.test('backward recurse director test', function (t) {
  let server = null
  const agent = helper.instrumentMockedAgent()

  const director = require('director')

  function fn0() {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }
  function fn1() {
    null
  }

  const routes = {
    '/hello': {
      'get': fn0,
      '/(\\w+)/': {
        get: fn1
      }
    }
  }

  const router = new director.http.Router(routes).configure({ recurse: 'backward' })

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close(function () {})
  })
  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Director/GET//hello', 'transaction has expected name')

    const web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Director/GET//hello', 'should have partial name for apdex')
  })

  server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const url = 'http://localhost:' + port + '/hello/eric'
      helper.makeGetRequest(url, { json: true }, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })
})

tap.test('two routers with same URI director test', function (t) {
  let server = null
  const agent = helper.instrumentMockedAgent()

  const director = require('director')

  const router = new director.http.Router()

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close(function () {})
  })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Director/GET//helloWorld',
      'transaction has expected name'
    )

    const web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Director/GET//helloWorld', 'should have partial name for apdex')
  })

  router.get('/helloWorld', function () {})
  router.get('/helloWorld', function () {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  })

  server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const url = 'http://localhost:' + port + '/helloWorld'
      helper.makeGetRequest(url, { json: true }, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })
})

tap.test('director async routes test', function (t) {
  let server = null
  const agent = helper.instrumentMockedAgent()

  const director = require('director')

  const router = new director.http.Router().configure({ async: true })

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close(function () {})
  })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Director/GET//:foo/:bar/:bazz',
      'transaction has expected name'
    )

    const web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Director/GET//:foo/:bar/:bazz', 'should have partial name for apdex')

    const handler0 = web.children[0]

    t.equal(
      handler0.name,
      'Nodejs/Middleware/Director/fn0//:foo/:bar/:bazz',
      'route 0 segment has correct name'
    )

    const handler1 = web.children[1]

    t.equal(
      handler1.name,
      'Nodejs/Middleware/Director/fn1//:foo/:bar/:bazz',
      'route 1 segment has correct name'
    )
  })

  router.get('/:foo/:bar/:bazz', function fn0(foo, bar, bazz, next) {
    setTimeout(
      function () {
        next()
      },
      100,
      this
    )
  })
  router.get('/:foo/:bar/:bazz', function fn1() {
    setTimeout(
      function (self) {
        self.res.end('dog')
      },
      100,
      this
    )
  })

  server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const url = 'http://localhost:' + port + '/three/random/things'
      helper.makeGetRequest(url, { json: true }, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, 'dog', 'got expected response')
        t.end()
      })
    })
  })
})

tap.test('express w/ director subrouter test', function (t) {
  t.plan(4)
  const agent = helper.instrumentMockedAgent()

  const director = require('director')

  const express = require('express')
  const expressRouter = express.Router() // eslint-disable-line new-cap
  const app = express()
  let server

  function helloWorld() {
    this.res.writeHead(200, { 'Content-Type': 'text/plain' })
    this.res.end('eric says hello')
  }

  const routes = {
    '/hello': { get: helloWorld }
  }
  const router = new director.http.Router(routes)

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close(function () {})
  })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Director/GET//express/hello',
      'transaction has expected name'
    )

    const web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Director/GET//express/hello', 'should have partial name for apdex')
  })

  expressRouter.use(function myMiddleware(req, res, next) {
    router.dispatch(req, res, function (err) {
      if (err) {
        next(err)
      }
    })
  })

  app.use('/express/', expressRouter)

  helper.randomPort(function (port) {
    server = app.listen(port, 'localhost', function () {
      const url = 'http://localhost:' + port + '/express/hello'
      helper.makeGetRequest(url, { json: true }, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, 'eric says hello', 'got expected response')
      })
    })
  })
})

tap.test('director instrumentation', function (t) {
  t.plan(10)

  t.test('should allow null routers through constructor on http router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const routes = {
      '/hello': null
    }

    new director.http.Router(routes) // eslint-disable-line no-new

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through constructor on base router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const routes = {
      '/hello': null
    }

    new director.Router(routes) // eslint-disable-line no-new

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through constructor on cli router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const routes = {
      '/hello': null
    }

    new director.cli.Router(routes) // eslint-disable-line no-new

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow routers through .on on cli router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.cli.Router()
    router.on(/^$/, function () {})

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow routers through .on on http router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.http.Router()
    router.on('get', /^$/, function () {})

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow routers through .on on base router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.Router()
    router.on(/^$/, function () {})

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through method mounters', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.http.Router()

    router.get('/tes/', null)

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through .on on http router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.http.Router()

    router.on('get', '/test/')

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through .on on cli router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.cli.Router()

    router.on('get', 'test')

    helper.unloadAgent(agent)
    t.end()
  })

  t.test('should allow null routers through .on on base router', function (t) {
    const agent = helper.instrumentMockedAgent()
    const director = require('director')
    const router = new director.Router()

    router.on('get', 'test')

    helper.unloadAgent(agent)
    t.end()
  })
})
