'use strict'

const tap = require('tap')
const read = require('fs').readFileSync
const join = require('path').join
const https = require('https')
const url = require('url')
const collector = require('../lib/fake-collector')
const RemoteMethod = require('../../lib/collector/remote-method')

tap.test('DataSender (callback style) talking to fake collector', (t) => {
  const config = {
    host: 'ssl.lvh.me',
    port: 8765,
    run_id: 1337,
    ssl: true,
    license_key: 'whatever',
    version: '0',
    max_payload_size_in_bytes: 1000000
  }
  config.certificates = [
    read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
  ]
  const method = new RemoteMethod('preconnect', config)

  collector({port: 8765}, (error, server) => {
    if (error) {
      t.fail(error)
      return t.end()
    }

    t.tearDown(() => {
      server.close()
    })

    method._post('[]', {}, (error, results, json) => {
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
})

tap.test('remote method to preconnect', (t) => {
  t.plan(1)

  t.test('https with custom certificate', (t) => {
    t.plan(3)
    const method = createRemoteMethod()

    // create mock collector
    startMockCollector(t, () => {
      method.invoke([], {}, (error, returnValue) => {
        validateResponse(t, error, returnValue)
        t.end()
      })
    })
  })

  function validateResponse(t, error, returnValue) {
    t.error(error, 'should not have an error')
    t.equal(returnValue, 'some-collector-url', 'should get expected response')
  }

  function createRemoteMethod() {
    const config = {
      host: 'ssl.lvh.me',
      port: 8765,
      ssl: true,
      max_payload_size_in_bytes: 1000000
    }

    config.certificates = [
      read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
    ]

    const method = new RemoteMethod('preconnect', config)
    return method
  }

  function startMockCollector(t, startedCallback) {
    const opts = {
      port: 8765
    }

    opts.key = read(join(__dirname, '../lib/test-key.key'))
    opts.cert = read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
    const server = https.createServer(opts, responder)

    server.listen(8765, (err) => {
      startedCallback(err, this)
    })

    t.tearDown(() => {
      server.close()
    })

    function responder(req, res) {
      const parsed = url.parse(req.url, true)
      t.equal(parsed.query.method, 'preconnect', 'should get redirect host request')
      res.write(JSON.stringify({return_value: 'some-collector-url'}))
      res.end()
    }
  }
})
