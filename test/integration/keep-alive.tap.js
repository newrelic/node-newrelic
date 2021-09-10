/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const read = require('fs').readFileSync
const join = require('path').join
const https = require('https')
const RemoteMethod = require('../../lib/collector/remote-method')
const { SSL_HOST } = require('../lib/agent_helper')

const MAX_PORT_ATTEMPTS = 5

tap.test('RemoteMethod makes two requests with one connection', (t) => {
  t.ok(true, 'Setup Test')

  // create a basic https server using our standard test certs
  const opts = {
    key: read(join(__dirname, '../lib/test-key.key')),
    cert: read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
  }
  const server = https.createServer(opts, function (req, res) {
    res.write('hello ssl')
    res.end()
  })
  server.keepAliveTimeout = 2000

  // set a reasonable server timeout for cleanup
  // of the server's keep-alive connections
  server.setTimeout(5000, (socket) => {
    socket.end()
    server.close()
  })

  // close server when test ends
  t.teardown(() => {
    server.close()
  })

  let attempts = 0
  server.on('error', (e) => {
    // server port not guranteed to be not in use
    if (e.code === 'EADDRINUSE') {
      if (attempts >= MAX_PORT_ATTEMPTS) {
        // eslint-disable-next-line no-console
        console.log('Exceeded max attempts (%s), bailing out.', MAX_PORT_ATTEMPTS)
        throw new Error('Unable to get unused port')
      }

      attempts++

      // eslint-disable-next-line no-console
      console.log('Address in use, retrying...')
      setTimeout(() => {
        server.close()

        // start the server using a random port
        server.listen()
      }, 1000)
    }
  })

  // start the server using a random port
  server.listen()

  // make requests once successfully running
  server.on('listening', () => {
    const port = server.address().port

    // once we start a server, use a RemoteMethod
    // object to make a request
    const method = createRemoteMethod(port)
    method.invoke({}, [], function (err, res) {
      t.ok(200 === res.status, 'First request success')

      // once first request is done, create a second request
      const method2 = createRemoteMethod(port)
      method2.invoke({}, [], function (err2, res2) {
        t.ok(200 === res2.status, 'Second request success')
        // end the test
        t.end()
      })
    })
  })

  let connections = 0

  // setup a connection listener for the server
  // if we see more than one, keep alive isn't
  // working.
  server.on('connection', function () {
    connections++
    if (2 === connections) {
      t.fail('RemoteMethod made second connection despite keep-alive.')
    }
  })
})

function createRemoteMethod(port) {
  const config = {
    ssl: true,
    max_payload_size_in_bytes: 1000000,
    feature_flag: {}
  }

  const endpoint = {
    host: SSL_HOST,
    port: port
  }

  config.certificates = [read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')]

  const method = new RemoteMethod('fake', config, endpoint)
  return method
}
