'use strict'

var test = require('tap').test
var helper  = require('../../lib/agent_helper')
var request = require('request')
var http = require('http')

test('app should be at top of stack when mounted', function (t) {
  var agent = helper.instrumentMockedAgent()
  var express = require('express')

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  t.plan(2)

  var main = express()
  var child = express()

  child.on('mount', function() {
    t.equal(
      main._router.stack.length,
      3,
      '3 middleware functions: query parser, Express, child'
    )
  })

  main.use(child)

  t.equal(
    main._router.stack.length,
    4,
    '4 middleware functions: query parser, Express, child, error trapper'
  )
})

test('app should be at top of stack when mounted', function (t) {
  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var main = express()
  var app = express()
  var app2 = express()
  var router = new express.Router()
  var router2 = new express.Router()
  var server = http.createServer(main)

  this.tearDown(function() {
    helper.unloadAgent(agent)
    server.close()
  })

  main.use('/:app', app)
  main.use('/:router', router)
  app.use('/nestedApp', app2)
  router.use('/nestedRouter', router2)
  app.get('/:child/app', respond)
  app2.get('/', respond)
  router.get('/:child/router', respond)
  router2.get('/', respond)
  main.get('/:foo/:bar', respond)

  t.plan(10)

  server.listen(4123, function() {
    request.get('http://localhost:4123/myApp/myChild/app', function(err, res, body) {
      t.notOk(err)
      t.equal(
        body,
        'Expressjs/GET//:app/:child/app',
        'should set partialName correctly for nested apps'
      )
    })

    request.get('http://localhost:4123/myApp/nestedApp  ', function(err, res, body) {
      t.notOk(err)
      t.equal(
        body,
        'Expressjs/GET//:app/nestedApp/',
        'should set partialName correctly for deeply nested apps'
      )
    })

    request.get('http://localhost:4123/myApp/myChild/router', function(err, res, body) {
      t.notOk(err)
      t.equal(
        body,
        'Expressjs/GET//:router/:child/router',
        'should set partialName correctly for nested routers'
      )
    })

    request.get('http://localhost:4123/myApp/nestedRouter', function(err, res, body) {
      t.notOk(err)
      t.equal(
        body,
        'Expressjs/GET//:router/nestedRouter/',
        'should set partialName correctly for deeply nested routers'
      )
    })

    request.get('http://localhost:4123/foo/bar', function(err, res, body) {
      t.notOk(err)
      t.equal(
        body,
        'Expressjs/GET//:foo/:bar',
        'should reset partialName after passing through a router without a matching route'
      )
    })
  })

  function respond(req, res) {
    res.send(agent.getTransaction().partialName)
  }
})

test('should not pass wrong args when transaction is not present', function (t) {
  t.plan(5)

  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var main = express()
  var router = new express.Router()
  var router2 = new express.Router()
  var server = http.createServer(main)
  var args

  main.use('/', router)
  main.use('/', router2)

  this.tearDown(function() {
    helper.unloadAgent(agent)
    server.close()
  })

  router.get('/', function(req, res, next) {
    args = [req, res]
    agent.getTransaction().end(function() {
      next()
    })
  })

  router2.get('/', function(req, res, next) {
    t.equal(req, args[0])
    t.equal(res, args[1])
    t.equal(typeof next, 'function')
    res.send('ok')
  })

  server.listen(4123, function(err) {
    request.get('http://localhost:4123/', function(err, res, body) {
      t.notOk(err)
      t.equal(body, 'ok')
      t.end()
    })
  })
})
