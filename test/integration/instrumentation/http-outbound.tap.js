'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper.js')

test('external request segments should end when on error', function testError(t) {
  var agent = helper.loadTestAgent(t)
  var http = require('http')

  var notVeryReliable = http.createServer(function badHandler(req) {
    req.socket.end()
  })

  notVeryReliable.listen(0)

  helper.runInTransaction(agent, function inTransaction() {
    var req = http.get(notVeryReliable.address())

    req.on('error', function onError() {
      var segment = agent.tracer.getSegment().children[1]

      t.equal(
        segment.name,
        'External/localhost:' + notVeryReliable.address().port + '/',
        'should be named'
      )
      t.ok(segment.timer.start, 'should have started')
      t.ok(segment.timer.duration, 'should have ended')

      notVeryReliable.close(function closed() {
        t.end()
      })
    })
  })
})
