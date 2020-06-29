/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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
    // set a reasonable server timeout for cleanup
    // of the server's keep-alive connections
    server.server.setTimeout(5000)
    if (error) {
      t.fail(error)
      return t.end()
    }

    t.tearDown(() => {
      server.close()
    })

    method._post('[]', {}, (error, results) => {
      if (error) {
        t.fail(error)
        return t.end()
      }

      t.equal(
        results.payload,
        'collector-1.lvh.me:8089',
        'parsed result should come through'
      )
      t.ok(results.status, 'response status code should come through')

      t.end()
    })
  })
})

tap.test('remote method to preconnect', (t) => {
  t.plan(1)

  t.test('https with custom certificate', (t) => {
    t.plan(4)
    const method = createRemoteMethod()

    // create mock collector
    startMockCollector(t, () => {
      method.invoke([], {}, (error, response) => {
        validateResponse(t, error, response)
        t.end()
      })
    })
  })

  function validateResponse(t, error, response) {
    t.error(error, 'should not have an error')
    t.equal(response.payload, 'some-collector-url', 'should get expected response')
    t.ok(response.status, 'should get response status code')
  }

  function createRemoteMethod() {
    const config = {
      host: 'ssl.lvh.me',
      port: 9876,
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
    const port = 9876
    const opts = {
      port: port
    }

    opts.key = read(join(__dirname, '../lib/test-key.key'))
    opts.cert = read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
    const server = https.createServer(opts, responder)

    // set a reasonable server timeout for cleanup
    // of the server's keep-alive connections
    server.setTimeout(5000)

    server.listen(port, (err) => {
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
