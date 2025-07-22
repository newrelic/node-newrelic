/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const fakeCert = require('./fake-cert')
const http = require('http')
const https = require('https')
const cert = fakeCert({ commonName: 'localhost' })

function createServer() {
  const server = http.createServer((req, res) => {
    if (req.url.includes('/delay')) {
      const parts = req.url.split('/')
      const delayInMs = parts[parts.length - 1]
      setTimeout(() => {
        res.writeHead(200)
        res.end('ok')
      }, delayInMs)
    } else if (req.url.includes('/status')) {
      const parts = req.url.split('/')
      const statusCode = parts[parts.length - 1]
      res.writeHead(statusCode)
      res.end()
    } else if (req.url.includes('/headers')) {
      const data = JSON.stringify(req.headers)
      res.writeHead(200, {
        'Content-Length': data.length,
        'Content-Type': 'application/json'
      })
      res.end(data)
    } else {
      res.writeHead(200)
      res.end('ok')
    }
  })

  server.listen(0)
  const { port } = server.address()
  const PORT = port
  const HOST = `localhost:${port}`
  const REQUEST_URL = `http://${HOST}`
  return { server, PORT, HOST, REQUEST_URL }
}

function createHttpsServer() {
  const httpsServer = https.createServer(
    { key: cert.privateKey, cert: cert.certificate },
    (req, res) => {
      res.write('SSL response')
      res.end()
    }
  )

  httpsServer.listen(0)
  return { httpsServer, cert }
}

function createSocketServer() {
  const socketEndServer = http.createServer(function badHandler(req) {
    req.socket.end()
  })

  socketEndServer.listen(0)
  return socketEndServer
}

module.exports = {
  createServer,
  createSocketServer,
  createHttpsServer
}
