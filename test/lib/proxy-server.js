/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createProxyServer

const https = require('node:https')
const net = require('node:net')
const assert = require('node:assert')

const connectResponse = [
  'HTTP/1.1 200 Connection Established',
  'Proxy-agent: Node.js-Proxy',
  '\r\n'
].join('\r\n')

/**
 * An extension of core's `https.Server` with utilities specific to the proxy.
 *
 * @augments http.Server
 * @typedef {object} ProxyServer
 * @property
 */

/**
 * Creates an HTTPS proxying server that listens on a random port on 127.0.0.1.
 * This is useful when testing agent connections to the collector via the proxy
 * configuration. The passed in certificate details should have a common name
 * that matches the upstream proxied host.
 *
 * @param {object} params
 * @param {string} params.privateKey A PEM formatted TLS certificate private key.
 * @param {string} params.certificate A PEM formatted TLS public certificate.
 *
 * @returns {Promise<ProxyServer>}
 */
async function createProxyServer({ privateKey, certificate } = {}) {
  assert.equal(typeof privateKey === 'string', true)
  assert.equal(typeof certificate === 'string', true)

  // This proxy server is pretty much a straight copy from the docs:
  // https://nodejs.org/api/http.html#event-connect.
  const server = https.createServer({ key: privateKey, cert: certificate })

  /**
   * Indicates is the proxy has serviced any connections.
   *
   * @type {boolean}
   * @memberof ProxyServer
   */
  server.proxyUsed = false

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const connections = []
  server.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = new URL(`http://${req.url}`)
    const serverSocket = net.connect(port || 443, hostname, () => {
      connections.push({ clientSocket, serverSocket })
      clientSocket.write(connectResponse)
      serverSocket.write(head)
      serverSocket.pipe(clientSocket)
      clientSocket.pipe(serverSocket)
    })

    serverSocket.on('data', () => {
      server.proxyUsed = true
    })
  })

  /**
   * Terminates all connections to the proxy and stops the server.
   *
   * @memberof ProxyServer
   */
  server.shutdown = () => {
    for (const conn of connections) {
      conn.clientSocket.destroy()
      conn.serverSocket.destroy()
    }
    server.close()
    server.closeAllConnections()
  }

  return server
}
