'use strict'


var tap = require('tap')
var http = require('http')
var request = require('request')
var helper = require('../../lib/agent_helper.js')
var semver = require('semver')

tap.test("basic director test", function (t) {

  if (semver.satisfies(process.versions.node, '<0.12.x')) {
    t.plan(12)
  }
  else {
    t.plan(13)
  }
  var agent = helper.instrumentMockedAgent()
  var director = require('director')

  function fn0() {
    t.ok(agent.getTransaction(), "transaction is available")
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }
  function fn1() {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }

  var routes = {
    '/hello': {
      get: fn0,
      '/(\\w+)/': {
        get: fn1
      }
    }
  }

  var router = new director.http.Router(routes).configure({ recurse: 'forward' })

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Nodejs/GET//hello',
            "transaction has expected name")
    t.equal(transaction.url, '/hello/eric', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(web.partialName, 'Nodejs/GET//hello',
            "should have partial name for apdex")

    if (semver.satisfies(process.versions.node, '<0.12.x')) {
      var handler0 = web.children[0]
      t.equal(handler0.name, "Truncated/Function/fn0", "route 0 segment has correct name")
    }
    else {
      var handler0 = web.children[0]
      t.equal(handler0.name, "Function/fn0", "route 0 segment has correct name")
      var handler1 = web.children[1]
      t.equal(handler1.name, "Function/fn1", "route 1 segment has correct name")
    }
  })

  var server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/hello/eric',
                {json : true},
                function (error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected response")
      t.end()
    })
  })
})

tap.test("backward recurse director test", function (t) {

  t.plan(4)
  var agent = helper.instrumentMockedAgent()
  var director = require('director')

  function fn0() {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  }
  function fn1() {
    null
  }

  var routes = {
    '/hello': {
      get: fn0,
      '/(\\w+)/': {
        get: fn1
      }
    }
  }

  var router = new director.http.Router(routes).configure({ recurse: 'backward' })

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })
  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Nodejs/GET//hello',
            "transaction has expected name")

    var web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Nodejs/GET//hello',
            "should have partial name for apdex")
  })

  var server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/hello/eric',
                {json : true},
                function (error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected response")
      t.end()
    })
  })
})

tap.test("two routers with same URI director test", function (t) {

  t.plan(4)
  var agent = helper.instrumentMockedAgent()
  var director = require('director')

  var router = new director.http.Router()

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Nodejs/GET//helloWorld',
            "transaction has expected name")

    var web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Nodejs/GET//helloWorld',
            "should have partial name for apdex")
  })

  router.get('/helloWorld', function (req, res) {
    null
  })
  router.get('/helloWorld', function (req, res) {
    this.res.writeHead(200)
    this.res.end('{"status":"ok"}')
  })

  var server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/helloWorld',
                {json : true},
                function (error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected response")
      t.end()
    })
  })
})

tap.test("director async routes test", function (t) {
  t.plan(6)
  var agent = helper.instrumentMockedAgent()
  var director = require('director')

  var router = new director.http.Router().configure({ async: true })

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Nodejs/GET//:foo/:bar/:bazz',
            "transaction has expected name")

    var web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Nodejs/GET//:foo/:bar/:bazz',
            "should have partial name for apdex")
    var handler0 = web.children[0]
    t.equal(handler0.name, 'Function/fn0',
            "route 0 segment has correct name")
    var handler1 = web.children[0].children[0].children[0].children[0]
    t.equal(handler1.name, 'Function/fn1',
            "route 1 segment has correct name")
  })

  router.get('/:foo/:bar/:bazz', function fn0 (foo, bar, bazz, next) {
    setTimeout(function(self) { next() }, 100, this)
  })
  router.get('/:foo/:bar/:bazz', function fn1 (foo, bar, bazz, next) {
     setTimeout(function(self) { self.res.end('dog') }, 100, this)
  })

  var server = http.createServer(function (req, res) {
    router.dispatch(req, res, function (err) {
      if (err) {
        res.writeHead(404)
        res.end()
      }
    })
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/three/random/things',
                {json : true},
                function (error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, 'dog', "got expected response")
    })
  })
})

tap.test("express w/ director subrouter test", function (t) {
  t.plan(4)
  var agent = helper.instrumentMockedAgent()
  var director = require('director')

  var express = require('express')
  var expressRouter = express.Router()
  var app = express()
  var server

  function helloWorld() {
    this.res.writeHead(200, { 'Content-Type': 'text/plain' })
    this.res.end('eric says hello')
  }

  var routes = {
    '/hello': { get: helloWorld }
  }
  var router = new director.http.Router(routes)

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//express/hello',
            "transaction has expected name")

    var web = transaction.trace.root.children[0]
    t.equal(web.partialName, 'Expressjs/GET//express/hello',
            "should have partial name for apdex")
  })

  expressRouter.use(function myMiddleware(req, res, next) {
    router.dispatch(req, res, function (err) {
      if (err) {
        next(err)
      }
    })
  })

  app.use('/express/', expressRouter)

  server = app.listen(8089, 'localhost', function () {
    request.get('http://localhost:8089/express/hello',
                {json : true},
                function (error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, 'eric says hello', "got expected response")
    })
  })
})
