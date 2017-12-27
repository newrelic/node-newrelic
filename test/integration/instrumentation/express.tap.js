'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var http = require('http')

tap.test('Express transaction names are unaffected by errorware', function(t) {
  t.plan(1)

  var agent = helper.instrumentMockedAgent()
  var app = require('express')()

  agent.on('transactionFinished', function(tx) {
    var expected = 'WebTransaction/Expressjs/GET//test'
    t.equal(tx.trace.root.children[0].name, expected)
  })

  app.get('/test', function() {
    throw new Error('endpoint error')
  })

  app.use('/test', function(err, req, res, next) { // eslint-disable-line no-unused-vars
    res.send(err.message)
  })

  var server = app.listen(3000, function() {
    http.request({ port: 3000, path: '/test' }).end()
  })

  t.tearDown(function() {
    server.close()
    helper.unloadAgent(agent)
  })
})
