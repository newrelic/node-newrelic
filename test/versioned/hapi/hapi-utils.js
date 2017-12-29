'use strict'

var assertMetrics = require('../../lib/metrics_helper').assertMetrics
var assertSegments = require('../../lib/metrics_helper').assertSegments

exports.getServer = function getServer(cfg) {
  cfg = cfg || {}
  var host = cfg.host || 'localhost'
  var port = cfg.port || 0
  var opts = cfg.options || {}
  var hapi = cfg.hapi || require('hapi')
  var server

  if (hapi.createServer) {
    return hapi.createServer(host, port, opts)
  } else if (hapi.Server.prototype.connection) {
    // v8-16
    server = new hapi.Server()
    server.connection({
      host: host,
      port: port
    })
  } else {
    // v17
    server = new hapi.Server({
      host: host,
      port: port
    })
  }
  return server
}

exports.verifier = function verifier(t, verb) {
  verb = verb || 'GET'
  return function(transaction) {
    t.equal(transaction.name, 'WebTransaction/Hapi/' + verb + '//test/{id}',
            'transaction has expected name')
    t.equal(transaction.url, '/test/31337', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, verb, 'HTTP method is ' + verb)
    t.ok(transaction.trace, 'transaction has trace')

    var web = transaction.trace.root.children[0]
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')
    t.equal(web.partialName, 'Hapi/' + verb + '//test/{id}',
            'should have partial name for apdex')
    t.equal(web.parameters.id, '31337', 'namer gets parameters out of route')
  }
}

exports.checkMetrics = function checkMetrics(t, metrics, expected, path) {
  path = path || '/test'
  var expectedAll = [
    [{name: 'WebTransaction'}],
    [{name: 'WebTransactionTotalTime'}],
    [{name: 'HttpDispatcher'}],
    [{name: 'WebTransaction/Hapi/GET/' + path}],
    [{name: 'WebTransactionTotalTime/Hapi/GET/' + path}],
    [{name: 'Apdex/Hapi/GET/' + path}],
    [{name: 'Apdex'}]
  ]

  for (var i = 0; i < expected.length; i++) {
    var metric = expected[i]
    expectedAll.push([{name: metric}])
    expectedAll.push([{name: metric, scope: 'WebTransaction/Hapi/GET/' + path}])
  }

  assertMetrics(metrics, expectedAll, true, false)
}

exports.checkSegments = function checkSegments(t, segments, expected, opts) {
  t.doesNotThrow(function() {
    assertSegments(segments, expected, opts)
  }, 'should have expected segments')
}
