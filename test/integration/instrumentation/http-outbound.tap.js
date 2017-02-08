'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper.js')

tap.test('external requests', function(t) {
  t.autoend()

  t.test('segments should end on error', function(t) {
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

  t.test('should have expected child segments', function(t) {
    // The externals segment is based on the lifetime of the request and response.
    // These objects are event emitters and we consider the external to be
    // completed when the response emits `end`. Since there are actions that
    // happen throughout the requests lifetime on other events, each of those
    // sequences will be their own tree under the main external call. This
    // results in a tree with several sibling branches that might otherwise be
    // shown in a heirarchy. This is okay.
    var agent = helper.loadTestAgent(t)
    var http = require('http')

    var server = http.createServer(function(req, res) {
      req.resume()
      res.end('ok')
    })
    t.tearDown(function() {
      server.close()
    })

    server.listen(0)

    helper.runInTransaction(agent, function inTransaction(tx) {
      var url = 'http://localhost:' + server.address().port + '/some/path'
      http.get(url, function onResonse(res) {
        res.resume()
        res.once('end', function resEnded() {
          setTimeout(function timeout() {
            check(tx)
          }, 10)
        })
      })
    })

    function check(tx) {
      var external = tx.trace.root.children[0]
      t.equal(
        external.name,
        'External/localhost:' + server.address().port + '/some/path',
        'should be named as an external'
      )
      t.ok(external.timer.start, 'should have started')
      t.ok(external.timer.duration, 'should have ended')
      t.ok(external.children.length, 'should have children')

      var connect = external.children[0]
      t.equal(connect.name, 'net.Socket.connect', 'should be connect segment')
      t.equal(connect.children.length, 1, 'connect should have 1 child')

      var dnsLookup = connect.children[0]
      t.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')

      var callback = external.children[1] // or length - 1
      t.equal(callback.name, 'timers.setTimeout', 'should have timeout segment')

      t.end()
    }
  })

  t.test('should not duplicate the external segment', function(t) {
    var agent = helper.loadTestAgent(t)
    var https = require('https')

    helper.runInTransaction(agent, function inTransaction() {
      https.get('https://encrypted.google.com/', function onResonse(res) {
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
})
