'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')

test('should not include query in request_uri', function testError(t) {
  var agent = helper.loadTestAgent(t)
  t.plan(4)
  var http = require('http')
  var server = http.createServer(handler)

  server.listen(0)

  http.get({
    path: '/test?thing=123',
    host: 'localhost',
    port: server.address().port
  }, close)

  function handler(req, res) {
    agent.errors.add(agent.getTransaction(), new Error('notice me!'))
    req.resume()
    res.end('done!')
  }

  function close(res) {
    res.resume()
    server.close(check)
  }

  function check() {
    t.equal(agent.errors.errors.length, 1, 'should be 1 error')
    var error = agent.errors.errors[0]
    t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have correct transaction')
    t.equal(error[2], 'notice me!', 'should have right name')
    t.equal(error[4].request_uri, '/test', 'should not include query')
    t.end()
  }
})
