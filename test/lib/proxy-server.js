/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createProxyServer

const http = require('node:http')
const https = require('node:https')
const net = require('node:net')
const fakeCert = require('./fake-cert')

/**
 * An extension of core's `http.Server`/`https.Server` with utilities specific
 * to acting as a forward CONNECT proxy in tests.
 *
 * @augments http.Server
 * @typedef {object} ProxyServer
 * @property {string} host The host the server is listening on.
 * @property {number} port The port the server is listening on.
 * @property {string} proxyUrl A full `scheme://host:port` URL for the proxy.
 * @property {boolean} proxyUsed Indicates if the proxy has serviced any connection.
 * @property {number} bytesTransferred Running total of bytes piped through all successful tunnels.
 * @property {Function} resetTunnelCount Resets the internal counter used by `failTunnels`.
 * @property {Function} shutdown Destroys all tracked tunnel sockets and closes the server. Returns a Promise.
 */

/**
 * Creates a forward-HTTP-CONNECT proxy server that listens on a random port
 * on 127.0.0.1. Useful for testing agent connections that go through a
 * configured proxy.
 *
 * @param {object} [params] params object
 * @param {object} [params.cert] A cert from `./fake-cert` (`{privateKey, certificate}`
 * PEM strings) to TLS-terminate the proxy's own listening socket -- useful
 * when the proxy needs a specific common name. Ignored when `secure` is
 * `false`. When `secure` is `true` (the default) and no `cert` is given, one
 * is generated.
 * @param {boolean} [params.secure] When `false`, the proxy listens over plain
 * HTTP instead of HTTPS, and `cert` is ignored. Defaults to `true`.
 * @param {number} [params.failTunnels] The number of CONNECT tunnels,
 * starting from the first, to deliberately break by feeding non-TLS garbage
 * the instant the client's TLS ClientHello arrives -- this reliably produces
 * a real client `EPROTO` error, useful for simulating a misconfigured proxy.
 * Defaults to `0` (every tunnel succeeds).
 *
 * @returns {Promise<ProxyServer>}
 */
async function createProxyServer({ cert, secure = true, failTunnels = 0 } = {}) {
  let server
  if (secure) {
    const { privateKey, certificate } = cert || fakeCert()
    server = https.createServer({ key: privateKey, cert: certificate })
  } else {
    server = http.createServer()
  }
  server.unref()

  let totalBytesTransferred = 0
  let tunnelCount = 0
  const tunnelSockets = []

  server.on('connect', connectHandler)

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()))
  })

  const address = server.address()
  server.host = address.address
  server.port = address.port
  server.proxyUrl = `${secure ? 'https' : 'http'}://${server.host}:${server.port}`
  server.proxyUsed = false

  Object.defineProperty(server, 'bytesTransferred', {
    get() {
      return totalBytesTransferred
    }
  })

  /**
   * Resets the count of tunnels established so far, so a test can reuse the
   * same proxy (and thus the same `host`/`port` a process-wide proxy-agent
   * singleton may have already cached) while still getting a fresh
   * "first tunnel(s) fail" sequence.
   *
   * @memberof ProxyServer
   */
  server.resetTunnelCount = function resetTunnelCount() {
    tunnelCount = 0
  }

  /**
   * Destroys all tracked tunnel sockets and closes the server.
   *
   * @memberof ProxyServer
   * @returns {Promise<void>}
   */
  server.shutdown = function shutdown() {
    return new Promise((resolve) => {
      for (const socket of tunnelSockets) {
        socket.destroy()
      }
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  return server

  function connectHandler(req, clientSocket, head) {
    const { port, hostname } = new URL(`http://${req.url}`)
    server.emit('proxyConnect', { host: hostname, port })
    tunnelCount += 1

    if (tunnelCount <= failTunnels) {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      clientSocket.once('data', () => {
        clientSocket.write('not a tls server hello, just plain garbage bytes to break the handshake')
      })
      // The client aborts once it sees the broken handshake; swallow the
      // resulting error on this side, it is expected.
      clientSocket.on('error', () => {})
      return
    }

    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

      if (head && head.length > 0) {
        serverSocket.write(head)
        totalBytesTransferred += head.length
      }

      clientSocket.pipe(serverSocket)
      serverSocket.pipe(clientSocket)

      clientSocket.on('data', (chunk) => {
        server.proxyUsed = true
        totalBytesTransferred += chunk.length
        server.emit('proxyData', { direction: 'client->server', bytes: chunk.length })
      })

      serverSocket.on('data', (chunk) => {
        server.proxyUsed = true
        totalBytesTransferred += chunk.length
        server.emit('proxyData', { direction: 'server->client', bytes: chunk.length })
      })

      tunnelSockets.push(clientSocket, serverSocket)
    })

    serverSocket.on('error', (err) => {
      server.emit('proxyError', err)
      clientSocket.end()
    })

    clientSocket.on('error', (err) => {
      server.emit('proxyError', err)
      serverSocket.end()
    })

    clientSocket.on('end', () => {
      serverSocket.end()
    })

    serverSocket.on('end', () => {
      clientSocket.end()
    })
  }
}
