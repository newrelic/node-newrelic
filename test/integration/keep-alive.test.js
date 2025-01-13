/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const https = require('node:https')

const tspl = require('@matteo.collina/tspl')
const fakeCert = require('../lib/fake-cert')
const promiseResolvers = require('../lib/promise-resolvers')
const RemoteMethod = require('../../lib/collector/remote-method')

test('RemoteMethod makes two requests with one connection', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const { promise, resolve, reject } = promiseResolvers()
  const cert = fakeCert()
  const serverOpts = { key: cert.privateKey, cert: cert.certificate }
  const server = https.createServer(serverOpts, (req, res) => {
    res.write('hello ssl')
    res.end()
  })
  server.keepAliveTimeout = 2_000

  // Set a reasonable server timeout for cleanup of the server's
  // keep-alive connections.
  server.setTimeout(5_000, (socket) => {
    socket.end()
    server.close()
  })

  t.after(() => server.close())

  let connections = 0
  server.on('connection', () => {
    // Track the connections made to the server. We expect only one to be
    // made due to HTTP keep-alive being used.
    connections += 1
    if (connections === 2) {
      reject(Error('RemoteMethod made second connection despite keep-alive.'))
    }
  })

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const port = server.address().port
  const method = createRemoteMethod(port, cert)
  method.invoke({}, [], (error, res) => {
    plan.ifError(error)
    plan.equal(res.status, 200, 'first request success')

    const method2 = createRemoteMethod(port, cert)
    method2.invoke({}, [], (error2, res2) => {
      plan.equal(res2.status, 200, 'second request success')
      resolve()
    })
  })

  await promise
  plan.equal(connections, 1, 'should not have established more than 1 connection')
})

function createRemoteMethod(port, cert) {
  const config = {
    ssl: true,
    max_payload_size_in_bytes: 1_000_000,
    feature_flag: {}
  }

  const endpoint = {
    host: '127.0.0.1',
    port
  }

  config.certificates = [cert.certificate]

  const agent = { config, metrics: { measureBytes() {} } }
  return new RemoteMethod('fake', agent, endpoint)
}
