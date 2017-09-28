'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../lib/agent_helper')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics


/*
 *
 * CONSTANTS
 *
 */
var METRIC = 'WebTransaction/Restify/GET//hello/:name'


tap.test('should not crash when Restify handles a connection', function(t) {
  t.plan(7)

  var agent   = helper.instrumentMockedAgent()
  var restify = require('restify')
  var server  = restify.createServer()


  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close()
  })

  server.get('/hello/:name', function sayHello(req, res, next) {
    t.ok(agent.getTransaction(), "transaction should be available in handler")
    res.send('hello ' + req.params.name)
    next()
  })

  server.listen(8765, function() {
    t.notOk(agent.getTransaction(), "transaction shouldn't leak into server")

    request.get('http://localhost:8765/hello/friend', function(error, response, body) {
      if (error) return t.fail(error)
      t.notOk(agent.getTransaction(), "transaction shouldn't leak into external request")

      var metric = agent.metrics.getMetric(METRIC)
      t.ok(metric, "request metrics should have been gathered")
      t.equals(metric.callCount, 1, "handler should have been called")
      t.equals(body, '"hello friend"', "data returned by restify should be as expected")

      var found = false
      agent.environment.toJSON().forEach(function cb_forEach(pair) {
        if (pair[0] === 'Framework' && pair[1] === 'Restify') found = true
      })
      t.ok(found, "should indicate that restify itself is in play")
    })
  })
})

tap.test('Restify should still be instrumented when run with SSL', function(t) {
  t.plan(7)

  helper.withSSL(function cb_withSSL(error, key, certificate, ca) {
    if (error) {
      t.fail("unable to set up SSL: " + error)
      t.end()
    }

    var agent   = helper.instrumentMockedAgent()
    var restify = require('restify')
    var server  = restify.createServer({key : key, certificate : certificate})


    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
      server.close()
    })

    server.get('/hello/:name', function sayHello(req, res, next) {
      t.ok(agent.getTransaction(), "transaction should be available in handler")
      res.send('hello ' + req.params.name)
      next()
    })

    server.listen(8443, function() {
      t.notOk(agent.getTransaction(), "transaction shouldn't leak into server")

      request.get({url : 'https://ssl.lvh.me:8443/hello/friend', ca : ca},
                  function(error, response, body) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        t.notOk(agent.getTransaction(),
                "transaction shouldn't leak into external request")

        var metric = agent.metrics.getMetric(METRIC)
        t.ok(metric, "request metrics should have been gathered")
        t.equals(metric.callCount, 1, "handler should have been called")
        t.equals(body, '"hello friend"',
                 "data returned by restify should be as expected")

        var found = false
        agent.environment.toJSON().forEach(function cb_forEach(pair) {
          if (pair[0] === 'Framework' && pair[1] === 'Restify') found = true
        })
        t.ok(found, "should indicate that restify itself is in play")
      })
    })
  })
})

tap.test('Restify should generate middleware metrics', function(t) {
  t.plan(5)

  var agent = helper.instrumentMockedAgent()
  var restify = require('restify')
  var server = restify.createServer()

  t.tearDown(function() {
    helper.unloadAgent(agent)
    server.close()
  })

  server.use(function middleware(req, res, next) {
    t.ok(agent.getTransaction(), 'should be in transaction context')
    next()
  })

  server.use(function middleware2(req, res, next) {
    t.ok(agent.getTransaction(), 'should be in transaction context')
    next()
  })

  server.get('/foo/:bar', function handler(req, res, next) {
    t.ok(agent.getTransaction(), 'should be in transaction context')
    res.send({'message': 'done'})
    next()
  })

  var port = null
  server.listen(function() {
    port = server.address().port

    agent.on('transactionFinished', function(tx) {
      checkMetrics(t, tx.metrics, [
        // Metrics for this transaction with the right name.
        [{"name": "WebTransaction/Restify/GET//foo/:bar"}],
        [{"name": "WebTransactionTotalTime/Restify/GET//foo/:bar"}],
        [{"name": "Apdex/Restify/GET//foo/:bar"}],

        // Unscoped middleware metrics.
        [{"name": "Nodejs/Middleware/Restify/middleware//"}],
        [{"name": "Nodejs/Middleware/Restify/middleware2//"}],
        [{"name": "Nodejs/Middleware/Restify/handler//foo/:bar"}],

        // Scoped middleware metrics.
        [{"name": "Nodejs/Middleware/Restify/middleware//",
          "scope": "WebTransaction/Restify/GET//foo/:bar"}],
        [{"name": "Nodejs/Middleware/Restify/middleware2//",
          "scope": "WebTransaction/Restify/GET//foo/:bar"}],
        [{"name": "Nodejs/Middleware/Restify/handler//foo/:bar",
          "scope": "WebTransaction/Restify/GET//foo/:bar"}]
      ])
    })

    var url = 'http://localhost:' + port + '/foo/bar'
    request.get(url, function(err) {
      t.error(err, 'should not fail to make request')
    })
  })
})

function checkMetrics(t, metrics, expected, exclusive) {
  try {
    assertMetrics(metrics, expected, exclusive || false, false)
    t.pass('should have expected segments')
  } catch (e) {
    t.error(e, 'should have expected segments')
  }
}
