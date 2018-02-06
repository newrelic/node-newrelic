'use strict'

var net = require('net')
var https = require('https')
var tap = require('tap')
var fmt = require('util').format
var join = require('path').join
var proxySetup = require('proxy')
var read = require('fs').readFileSync
var configurator = require('../../lib/config')
var Agent = require('../../lib/agent')
var CollectorAPI = require('../../lib/collector/api')

tap.test("setting proxy_port should use the proxy agent", function(t) {
  var opts = {
    key: read(join(__dirname, '../lib/test-key.key')),
    cert: read(join(__dirname, '../lib/self-signed-test-certificate.crt')),
  }
  var server = proxySetup(https.createServer(opts))
  var port = 0

  server.listen(port, function() {
    port = server.address().port

    var config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy_port: port,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      },
      certificates: [
        read(join(__dirname, '..', 'lib', 'ca-certificate.crt'), 'utf8')
      ]
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)

    api.connect(function(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function(error, returned, json) {
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

tap.test("proxy agent with SSL tunnel to collector", function(t) {
  var server = proxySetup(https.createServer())
  var port = 0

  server.listen(port, function() {
    port = server.address().port

    var config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy: fmt('http://localhost:%d', port),
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)


    api.connect(function(error, returned) {
      t.notOk(error, "connected without error")
      t.ok(returned, "got boot configuration")
      t.ok(returned.agent_run_id, "got run ID")
      t.ok(agent.config.run_id, "run ID set in configuration")

      api.shutdown(function(error, returned, json) {
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

tap.test("proxy authentication should set headers", function(t) {
  t.plan(2)

  var server = net.createServer()

  server.on('connection', function(socket) {
    socket.on('data', function(chunk) {
      var data = chunk.toString().split('\r\n')
      t.equal(data[0], 'CONNECT staging-collector.newrelic.com:80 HTTP/1.1')
      t.equal(data[1], 'Proxy-Authorization: Basic YTpi')
      server.close()
    })
    socket.end()
  })

  var port = 0

  server.listen(port, function() {
    port = server.address().port

    var config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy: fmt('http://a:b@localhost:%d', port),
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      }
    })
    var agent = new Agent(config)
    var api = new CollectorAPI(agent)

    api.connect(function() {
      t.end()
    })
  })
})

test("no proxy set should not use proxy agent", function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  var agent = new Agent(config)
  var api = new CollectorAPI(agent)


  api.connect(function(error, returned) {
    t.notOk(error, "connected without error")
    t.ok(returned, "got boot configuration")
    t.ok(returned.agent_run_id, "got run ID")
    t.ok(agent.config.run_id, "run ID set in configuration")

    api.shutdown(function(error, returned, json) {
      t.notOk(error, "should have shut down without issue")
      t.equal(returned, null, "collector explicitly returns null")
      t.deepEqual(json, {return_value: null}, "raw message looks right")
      t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

      t.end()
    })
  })
})
