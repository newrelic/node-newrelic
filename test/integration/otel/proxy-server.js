/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')
const https = require('node:https')
const net = require('node:net')

/**
 * Creates a proxy server for testing that emits events for connection tracking.
 *
 * @param {object} options Configuration options
 * @param {object} [options.cert] To create a proxy that speaks HTTPS, pass
 * in a certificate chain. One is not generated internally because the agent
 * must also be configured with the same certificate chain via
 * `config.certificates`.
 *
 * @returns {Promise<Server>} The created proxy server
 */
module.exports = async function createProxyServer({ cert = null } = {}) {
  let server

  if (cert !== null) {
    const serverOpts = {
      key: cert.privateKeyBuffer,
      cert: cert.certificateBuffer
    }
    server = https.createServer(serverOpts)
  } else {
    server = http.createServer()
  }

  // Track data transfer and CONNECT tunnel sockets for cleanup
  let totalBytesTransferred = 0
  const tunnelSockets = []

  // Handle CONNECT method for HTTPS tunneling
  server.on('connect', connectHandler)

  // Handle regular HTTP requests
  server.on('request', requestHandler)

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) return reject(error)
      resolve()
    })
  })

  const address = server.address()

  Object.defineProperty(server, 'bytesTransferred', {
    get () { return totalBytesTransferred }
  })

  server.closeProxy = function closeProxy() {
    return new Promise((resolve) => {
      // Destroy all CONNECT tunnel sockets
      for (const socket of tunnelSockets) {
        socket.destroy()
      }

      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  server.proxyHost = address.address
  server.proxyPort = address.port
  server.proxyUrl = `${cert ? 'https' : 'http'}://${address.address}:${address.port}`

  return server

  function connectHandler(req, clientSocket, head) {
    const { port, hostname } = new URL(`http://${req.url}`)

    server.emit('proxyConnect', { host: hostname, port })

    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

      if (head && head.length > 0) {
        serverSocket.write(head)
        totalBytesTransferred += head.length
      }

      // Pipe data between client and server
      clientSocket.pipe(serverSocket)
      serverSocket.pipe(clientSocket)

      // Track data flow
      clientSocket.on('data', (chunk) => {
        totalBytesTransferred += chunk.length
        server.emit('proxyData', { direction: 'client->server', bytes: chunk.length })
      })

      serverSocket.on('data', (chunk) => {
        totalBytesTransferred += chunk.length
        server.emit('proxyData', { direction: 'server->client', bytes: chunk.length })
      })

      // Track sockets for cleanup
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

  function requestHandler(req, res) {
    server.emit('proxyRequest', { method: req.method, url: req.url })

    // Parse the target URL
    const targetUrl = new URL(req.url)
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: req.headers
    }

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)

      proxyRes.on('data', (chunk) => {
        totalBytesTransferred += chunk.length
        server.emit('proxyData', { direction: 'server->client', bytes: chunk.length })
      })

      proxyRes.pipe(res)
    })

    req.on('data', (chunk) => {
      totalBytesTransferred += chunk.length
      server.emit('proxyData', { direction: 'client->server', bytes: chunk.length })
    })

    req.pipe(proxyReq)

    proxyReq.on('error', (err) => {
      server.emit('proxyError', err)
      res.writeHead(500)
      res.end()
    })
  }
}
