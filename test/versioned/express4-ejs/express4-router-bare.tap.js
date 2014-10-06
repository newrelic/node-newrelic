'use strict'

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')
  

test("Express 4 router introspection", function (t) {
  t.plan(11)

  var agent   = helper.instrumentMockedAgent()
    , express = require('express')
    , app     = express()
    , server  = require('http').createServer(app)
    

  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//test',
            "transaction has expected name")
    t.equal(transaction.url, '/test', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(web.partialName, 'Expressjs/GET//test',
            "should have partial name for apdex")
  })

  app.get('/test', function (req, res) {
    t.ok(agent.getTransaction(), "transaction is available")

    res.send({status : 'ok'})
    res.end()
  })

  server.listen(8080, function () {
    request.get('http://localhost:8080/test',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected response")
    })
  })
})
