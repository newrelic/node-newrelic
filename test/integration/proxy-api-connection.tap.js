'use strict'

var path = require('path')
var net = require('net')
var http = require('http')
var https = require('https')
var test = require('tap').test
var fmt = require('util').format
var join = require('path').join
var proxySetup = require('proxy')
var semver = require('semver')
var read = require('fs').readFileSync
var configurator = require('../../lib/config')
var Agent = require('../../lib/agent')
var CollectorAPI = require('../../lib/collector/api.js')

test("support ssl to the proxy", function (t) {
  var port = 0
  var opts = {
    key: read(join(__dirname, '../lib/test-key.key')),
    cert: read(join(__dirname, '../lib/self-signed-test-certificate.crt')),
  }

  var server = setup(https.createServer(opts))

  server.listen(port, function () {
    port = server.address().port

    var config = configurator.initialize({
      'app_name': 'node.js Tests',
      'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      'host': 'staging-collector.newrelic.com',
      'proxy': 'https://ssl.lvh.me:' + port,
      'port': 443,
      'utilization': {
        'detect_aws': false,
        'detect_docker': false
      },
      'ssl': true,
      'certificates': [
        read(join(__dirname, '..', 'lib', 'ca-certificate.crt'), 'utf8')
      ]
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)

    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue")
        t.equal(returned, null, "collector explicitly returns null")
        t.deepEqual(json, {return_value: null}, "raw message looks right")
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

        server.close()
        t.end()
      })
    })
  })
})

test("setting proxy_port should use the proxy agent", function (t) {
  var server = setup(http.createServer())
  var port = 0

  server.listen(port, function () {
    port = server.address().port

    var config = configurator.initialize({
      'app_name': 'node.js Tests',
      'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      'host': 'staging-collector.newrelic.com',
      'port': 443,
      'proxy_port': port,
      'ssl': true,
      'utilization': {
        'detect_aws': false,
        'detect_docker': false
      },
      'logging': {
        'level': 'trace'
      }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)

    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue")
        t.equal(returned, null, "collector explicitly returns null")
        t.deepEqual(json, {return_value: null}, "raw message looks right")
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

        server.close()
        t.end()
      })
    })
  })
})

test("proxy agent with SSL tunnel to collector", function (t) {
  var server = setup(http.createServer())
  var port = 0

  server.listen(port, function () {
    port = server.address().port

    var config = configurator.initialize({
      'app_name': 'node.js Tests',
      'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      'host': 'staging-collector.newrelic.com',
      'port': 443,
      'proxy': fmt('http://localhost:%d', port),
      'ssl': true,
      'utilization': {
        'detect_aws': false,
        'detect_docker': false
      },
      'logging': {
        'level': 'trace'
      }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)


    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue")
        t.equal(returned, null, "collector explicitly returns null")
        t.deepEqual(json, {return_value: null}, "raw message looks right")
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

        server.close()
        t.end()
      })
    })
  })
})

test("proxy agent with plain text to collector", function (t) {
  var server = setup(http.createServer())
  var port = 0

  server.listen(port, function () {
    port = server.address().port

    var config = configurator.initialize({
      'app_name': 'node.js Tests',
      'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      'host': 'staging-collector.newrelic.com',
      'port': 80,
      'proxy_host': 'localhost', // Specifically use proxy_host and
      'proxy_port': port,        // proxy_port to test these settings
      'ssl': false,
      'utilization': {
        'detect_aws': false,
        'detect_docker': false
      },
      'logging': {
        'level': 'trace'
      }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)


    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue")
        t.equal(returned, null, "collector explicitly returns null")
        t.deepEqual(json, {return_value: null}, "raw message looks right")
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

        server.close()
        t.end()
      })
    })
  })
})

test("proxy authentication should set headers", function (t) {
  t.plan(2)

  var server = net.createServer()

  server.on('connection', function (socket) {
    socket.on('data', function (chunk) {
      var data = chunk.toString().split('\r\n')
      t.equal(data[0], 'CONNECT staging-collector.newrelic.com:80 HTTP/1.1')
      t.equal(data[1], 'Proxy-Authorization: Basic YTpi')
      server.close()
    })
    socket.end()
  })

  var port = 0

  server.listen(port, function () {
    port = server.address().port

    var config = configurator.initialize({
      'app_name': 'node.js Tests',
      'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      'host': 'staging-collector.newrelic.com',
      'port': 80,
      'proxy': fmt('http://a:b@localhost:%d', port),
      'ssl': false,
      'utilization': {
        'detect_aws': false,
        'detect_docker': false
      },
      'logging': { 'level': 'trace' }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)

    api.connect(function cb_connect() {
      t.end()
    })
  })
})

test("no proxy set should not use proxy agent", function (t) {
  var config = configurator.initialize({
    'app_name': 'node.js Tests',
    'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    'host': 'staging-collector.newrelic.com',
    'port': 443,
    'ssl': true,
    'utilization': {
      'detect_aws': false,
      'detect_docker': false
    },
    'logging': {
      'level': 'trace'
    }
  })
  var agent = new Agent(config)
  var api = new CollectorAPI(agent)


  api.connect(function cb_connect(error, returned) {
    t.notOk(error, "connected without error")
    t.ok(returned, "got boot configuration")
    t.ok(returned.agent_run_id, "got run ID")
    t.ok(agent.config.run_id, "run ID set in configuration")

    api.shutdown(function cb_shutdown(error, returned, json) {
      t.notOk(error, "should have shut down without issue")
      t.equal(returned, null, "collector explicitly returns null")
      t.deepEqual(json, {return_value: null}, "raw message looks right")
      t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

      t.end()
    })
  })
})

/*
  The proxy module has a bug in 0.8 where it doesn't always close the
  socket which results in hanging tests. This wraps the server up and
  destroys the sockets to fix it. The tests are still valid as they
  are testing that the proxy-agent module that we are using works
  correctly and is used when appropriate, this is just a work around
  for a small bug in the proxy server module.
*/
function setup (input) {
  var server = proxySetup(input)

  // Early return on 0.10 and higher as the proxy module works fine
  // there.
  if (semver.satisfies(process.version, '>=0.10')) {
    return server
  }
  var conns = []

  server.on('connection', function onConnection(conn) {
    conns.push(conn)
    conn.on('close', function () {
      var index = conns.indexOf(conn)
      if (index !== -1) {
        conns.splice(index, 1)
      }
    })
  })

  var serverClose = server.close
  server.close = function forceClose () {
    serverClose.apply(this, arguments)
    conns.forEach(function destroyerOfSockets (conn) {
      conn.destroy()
    })
  }
  return server
}
