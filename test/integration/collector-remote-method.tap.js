'use strict'

var path = require('path')
var test = require('tap').test
var read = require('fs').readFileSync
var join = require('path').join
var http = require('http')
var https = require('https')
var url = require('url')
var RemoteMethod = require('../../lib/collector/remote-method.js')
var collector = require('../lib/fake-collector.js')

test("DataSender (callback style) talking to fake collector", function (t) {
  var config = {
    host        : 'collector.lvh.me',
    port        : 8765,
    run_id      : 1337,
    license_key : 'whatever',
    version     : '0'
  }
  var method = new RemoteMethod('get_redirect_host', config)

  var suite = this
  collector({port : 8765}, function (error, server) {
    if (error) {
      t.fail(error)
      return t.end()
    }

    suite.tearDown(function cb_tearDown() {
      server.close()
    })

    method._post('[]', function (error, results, json) {
      if (error) {
        t.fail(error)
        return t.end()
      }

      t.equal(results, 'collector-1.lvh.me:8089', 'parsed result should come through')
      t.notOk(json.validations, "fake collector should find no irregularities")
      t.equal(json.return_value, 'collector-1.lvh.me:8089',
              "collector returns expected collector redirect")

      t.end()
    })
  })
})

test("remote method to get redirect host", function (t) {

  t.test("https with custom certificate", function(t) {
    var test = t
    var method = createRemoteMethod(true, true)

    // create mock collector
    startMockCollector(true, function(err, server) {
      method.invoke([], function(error, returnValue, json) {
        validateResponse(test, error, returnValue)
        server.close()
        t.end()
      })
    })
  })

  t.test("http without custom certificate", function(t) {
    var test = t
    var method = createRemoteMethod(false, false)

    // create mock collector
    startMockCollector(false, function(err, server) {
      method.invoke([], function(error, returnValue, json) {
        validateResponse(test, error, returnValue)
        server.close()
        t.end()
      })
    })
  })

  t.test("http with custom certificate", function(t) {
    var test = t
    var method = createRemoteMethod(false, true)

    // create mock collector
    startMockCollector(false, function(err, server) {
      method.invoke([], function(error, returnValue, json) {
        validateResponse(test, error, returnValue)
        server.close()
        t.end()
      })
    })
  })

  function validateResponse(t, error, returnValue) {
    if (error) {
      t.fail(error)
    }
    t.equal(returnValue, 'some-collector-url', 'got back expected response')
  }

  function createRemoteMethod(ssl, useCertificate) {
    var config = {
      host: 'localhost',
      port: 8765
    }

    if (ssl) {
      config['host'] = 'ssl.lvh.me'
      config['ssl'] = true
    }

    if (useCertificate) {
      config['certificates'] = read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
    }

    var method = new RemoteMethod('get_redirect_host', config)
    return method
  }

  function startMockCollector(ssl, startedCallback) {
    var opts = {
      port: 8765
    }

    var server
    if (ssl) {
      opts['key'] = read(join(__dirname, '../lib/test-key.key'))
      opts['cert'] = read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
      server = https.createServer(opts, responder)
    } else {
      server = http.createServer(responder)
    }

    server.listen(8765, function(err) {
      startedCallback(err, this)
    })

    function responder(req, res) {
      var parsed = url.parse(req.url, true)
      t.equal(parsed.query['method'], 'get_redirect_host', 'got redirect host request')
      res.write(JSON.stringify({
        "return_value": "some-collector-url"
      }))
      res.end()
    }
  }
})
