'use strict'

var tap = require('tap')
var read = require('fs').readFileSync
var join = require('path').join
var https = require('https')
var url = require('url')
var collector = require('../lib/fake-collector')
var semver = require('semver')
var RemoteMethod = require('../../lib/collector/remote-method')

// Specifying custom certs on 0.10 sends the process into a spin lock,
// so we skip it.
tap.test(
  'DataSender (callback style) talking to fake collector',
  {skip: semver.satisfies(process.version, '0.10.x')},
  function(t) {
    var config = {
      host: 'ssl.lvh.me',
      port: 8765,
      run_id: 1337,
      ssl: true,
      license_key: 'whatever',
      version: '0'
    }
    config.certificates = [
      read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
    ]
    var method = new RemoteMethod('preconnect', config)

    collector({port: 8765}, function(error, server) {
      if (error) {
        t.fail(error)
        return t.end()
      }

      t.tearDown(function() {
        server.close()
      })

      method._post('[]', function(error, results, json) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        t.equal(results, 'collector-1.lvh.me:8089', 'parsed result should come through')
        t.notOk(json.validations, 'fake collector should find no irregularities')
        t.equal(
          json.return_value,
          'collector-1.lvh.me:8089',
          'collector returns expected collector redirect'
        )

        t.end()
      })
    })
  }
)

tap.test('remote method to get redirect host', function(t) {
  t.plan(2)
  t.test('https with custom certificate', function(t) {
    t.plan(3)
    var method = createRemoteMethod(true)

    // create mock collector
    startMockCollector(t, function() {
      method.invoke([], function(error, returnValue) {
        validateResponse(t, error, returnValue)
        t.end()
      })
    })
  })

  t.test('https without custom certificate', function(t) {
    t.plan(3)
    var method = createRemoteMethod(false)

    // create mock collector
    startMockCollector(t, function() {
      method.invoke([], function(error, returnValue) {
        validateResponse(t, error, returnValue)
        t.end()
      })
    })
  })

  function validateResponse(t, error, returnValue) {
    t.notOk(error, 'should not have an error')
    t.equal(returnValue, 'some-collector-url', 'should get expected response')
  }

  function createRemoteMethod(useCertificate) {
    var config = {
      host: 'ssl.lvh.me',
      port: 8765,
      ssl: true,
    }

    config.certificates = [
      read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
    ]

    var method = new RemoteMethod('preconnect', config)
    return method
  }

  function startMockCollector(t, startedCallback) {
    var opts = {
      port: 8765
    }

    opts.key = read(join(__dirname, '../lib/test-key.key'))
    opts.cert = read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
    var server = https.createServer(opts, responder)

    server.listen(8765, function(err) {
      startedCallback(err, this)
    })

    t.tearDown(function() {
      server.close()
    })

    function responder(req, res) {
      var parsed = url.parse(req.url, true)
      t.equal(parsed.query.method, 'preconnect', 'should get redirect host request')
      res.write(JSON.stringify({return_value: 'some-collector-url'}))
      res.end()
    }
  }
})
