/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('http')

module.exports = async function testServer() {
  const server = http.createServer()

  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('"ok"')
  })

  let address = await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) {
        return reject(error)
      }
      return resolve(server.address())
    })
  })

  address = `http://${address.address}:${address.port}`

  return { address, server, stopServer }

  async function stopServer() {
    await new Promise((resolve, reject) => {
      if (server.closeAllConnections) {
        // Node.js 16 does not support this method.
        server.closeAllConnections()
      }
      server.close((error) => {
        if (error) {
          return reject(error)
        }
        return resolve()
      })
    })
  }
}
