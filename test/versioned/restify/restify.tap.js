'use strict'

var tap     = require('tap')
var request = require('request')
var helper  = require('../../lib/agent_helper')


var METRIC = 'WebTransaction/Restify/GET//hello/:name'


tap.test("shouldn't crash when Restify handles a connection", function(t) {
  t.plan(7)

  var agent   = helper.instrumentMockedAgent()
  var restify = require('restify')
  var server  = restify.createServer()


  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close()
  })

  server.get('/hello/:name', function sayHello(req, res) {
    t.ok(agent.getTransaction(), "transaction should be available in handler")
    res.send('hello ' + req.params.name)
  })

  server.listen(0, function() {
    var port = server.address().port
    t.notOk(agent.getTransaction(), "transaction shouldn't leak into server")

    var url = 'http://localhost:' + port + '/hello/friend'
    request.get(url, function(error, response, body) {
      if (error) return t.fail(error)
      t.notOk(agent.getTransaction(), "transaction shouldn't leak into external request")

      var metric = agent.metrics.getMetric(METRIC)
      t.ok(metric, "request metrics should have been gathered")
      t.equals(metric.callCount, 1, "handler should have been called")
      t.equals(body, '"hello friend"', 'should return expected data')

      var isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
      t.ok(isFramework, 'should indicate that restify is a framework')
    })
  })
})

tap.test("Restify should still be instrumented when run with SSL", function(t) {
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

    server.get('/hello/:name', function sayHello(req, res) {
      t.ok(agent.getTransaction(), "transaction should be available in handler")
      res.send('hello ' + req.params.name)
    })

    server.listen(0, function() {
      var port = server.address().port
      t.notOk(agent.getTransaction(), "transaction shouldn't leak into server")

      var opts = {url : 'https://ssl.lvh.me:' + port + '/hello/friend', ca : ca}
      request.get(opts, function(error, response, body) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        t.notOk(agent.getTransaction(),
                "transaction shouldn't leak into external request")

        var metric = agent.metrics.getMetric(METRIC)
        t.ok(metric, "request metrics should have been gathered")
        t.equals(metric.callCount, 1, "handler should have been called")
        t.equals(body, '"hello friend"', 'should return expected data')

        var isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
        t.ok(isFramework, 'should indicate that restify is a framework')
      })
    })
  })
})
