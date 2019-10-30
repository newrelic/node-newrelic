'use strict'

const helper = require('../../lib/agent_helper')
const tap = require('tap')


tap.test('external requests', function(t) {
  t.autoend()

  let agent = null
  let http = null
  t.beforeEach((done) => {
    agent = helper.instrumentMockedAgent()
    http = require('http')
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('segments should end on error', function(t) {
    var notVeryReliable = http.createServer(function badHandler(req) {
      req.socket.end()
    })

    notVeryReliable.listen(0)

    helper.runInTransaction(agent, function inTransaction() {
      var req = http.get(notVeryReliable.address())

      req.on('error', function onError() {
        var segment = agent.tracer.getTransaction().trace.root.children[0]

        t.equal(
          segment.name,
          'External/localhost:' + notVeryReliable.address().port + '/',
          'should be named'
        )
        t.ok(segment.timer.start, 'should have started')
        t.ok(segment.timer.hasEnd(), 'should have ended')

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
      t.ok(external.timer.hasEnd(), 'should have ended')
      t.ok(external.children.length, 'should have children')

      var connect = external.children[0]
      t.equal(connect.name, 'http.Agent#createConnection', 'should be connect segment')
      t.equal(connect.children.length, 1, 'connect should have 1 child')

      // There is potentially an extra layer of create/connect segments.
      if (connect.children[0].name === 'net.Socket.connect') {
        connect = connect.children[0]
      }

      var dnsLookup = connect.children[0]
      t.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')

      var callback = external.children[external.children.length - 1]
      t.equal(callback.name, 'timers.setTimeout', 'should have timeout segment')

      t.end()
    }
  })

  t.test('should not duplicate the external segment', function(t) {
    var https = require('https')

    helper.runInTransaction(agent, function inTransaction() {
      https.get('https://encrypted.google.com:443/', function onResonse(res) {
        res.once('end', check)
        res.resume()
      })
    })

    function check() {
      var root = agent.tracer.getTransaction().trace.root
      var segment = root.children[0]

      t.equal(
        segment.name,
        'External/encrypted.google.com:443/',
        'should be named'
      )
      t.ok(segment.timer.start, 'should have started')
      t.ok(segment.timer.hasEnd(), 'should have ended')
      t.equal(segment.children.length, 1, 'should have 1 child')

      var notDuped = segment.children[0]
      t.notEqual(
        notDuped.name,
        segment.name,
        'child should not be named the same as the external segment'
      )

      t.end()
    }
  })

  t.test('NODE-1647 should not interfere with `got`', {timeout: 5000}, function(t) {
    // Our way of wrapping HTTP response objects caused `got` to hang. This was
    // resolved in agent 2.5.1.
    var got = require('got')
    helper.runInTransaction(agent, function() {
      var req = got('https://example.com/')
      t.tearDown(function() { req.cancel() })
      req.then(
        function() { t.end() },
        function(e) { t.error(e); t.end() }
      )
    })
  })

  t.test('should record requests to default ports', (t) => {
    helper.runInTransaction(agent, (tx) => {
      http.get('http://example.com', (res) => {
        res.resume()
        res.on('end', () => {
          const segment = tx.trace.root.children[0]
          t.equal(segment.name, 'External/example.com/', 'should create external segment')
          t.end()
        })
      })
    })
  })

  t.test('should expose the external segment on the http request', (t) => {
    helper.runInTransaction(agent, (tx) => {
      let reqSegment = null
      const req = http.get('http://example.com', (res) => {
        res.resume()
        res.on('end', () => {
          const segment = tx.trace.root.children[0]
          t.equal(segment.getAttributes().url, 'http://example.com/')
          t.equal(segment.getAttributes().procedure, 'GET')
          t.equal(reqSegment, segment, 'should expose external')
          t.end()
        })
      })
      reqSegment = req.__NR_segment
    })
  })
})
