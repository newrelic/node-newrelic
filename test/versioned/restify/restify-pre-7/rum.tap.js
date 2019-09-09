'use strict'

var tap    = require('tap')
var request = require('request').defaults({json: true})
var helper  = require('../../../lib/agent_helper')
var API     = require('../../../../api')


tap.test("Restify router introspection", function(t) {
  t.plan(3)

  const agent  = helper.instrumentMockedAgent()
  const server = require('restify').createServer()
  const api    = new API(agent)

  agent.config.application_id = '12345'
  agent.config.browser_monitoring.browser_key = '12345'
  agent.config.browser_monitoring.js_agent_loader = 'function(){}'

  t.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  server.get('/test/:id', function(req, res, next) {
    var rum = api.getBrowserTimingHeader()
    t.equal(rum.substr(0,7), '<script')
    res.send({status : 'ok'})
    next()
  })

  server.listen(0, function() {
    var port = server.address().port
    request.get('http://localhost:' + port + '/test/31337', function(error, res, body) {
      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected respose")
      t.end()
    })
  })
})
