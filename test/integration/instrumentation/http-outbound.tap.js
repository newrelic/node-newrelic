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
      var segment = agent.tracer.getSegment()

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

test('external requests should have child segments', function testError(t) {
  var agent = helper.loadTestAgent(t)
  var http = require('http')

  var server = http.createServer(function badHandler(req, res) {
    req.resume()
    res.end('ok')
  })

  server.listen(0)

  helper.runInTransaction(agent, function inTransaction() {
    var req = http.get(server.address(), function onResonse(res) {
      res.once('end', check)
      res.resume()
    })
  })

  function check() {
    var segment = agent.tracer.getSegment()

    t.equal(
      segment.name,
      'External/localhost:' + server.address().port + '/',
      'should be named'
    )
    t.ok(segment.timer.start, 'should have started')
    t.ok(segment.timer.duration, 'should have ended')
    t.equal(segment.children.length, 1, 'should have 1 child')

    var connect = segment.children[0]
    t.equal(connect.name, 'net.Socket.connect', 'should be connect segment')
    t.equal(connect.children.length, 1, 'connect should have 1 child')

    var dnsLookup = connect.children[0]
    t.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')
    t.equal(dnsLookup.children.length, 1, 'dns.lookup should have 1 child')
    t.equal(dnsLookup.children[0].name, 'Callback: anonymous', 'should have callback')

    server.close(function() {
      t.end()
    })
  }
})

test('external https requests should not duplicate the external segment', function testError(t) {
  var agent = helper.loadTestAgent(t)
  var https = require('https')

  helper.runInTransaction(agent, function inTransaction() {
    var req = https.get('https://encrypted.google.com/', function onResonse(res) {
      res.once('end', check)
      res.resume()
    })
  })

  function check() {
    var segment = agent.tracer.getSegment()

    t.equal(
      segment.name,
      'External/encrypted.google.com/',
      'should be named'
    )
    t.ok(segment.timer.start, 'should have started')
    t.ok(segment.timer.duration, 'should have ended')
    t.equal(segment.children.length, 1, 'should have 1 child')

    var notDuped = segment.children[0]
    t.notEqual(
        notDuped.name,
        segment.name,
        'should not be named the same as the external segment')

    t.end()
  }
})
