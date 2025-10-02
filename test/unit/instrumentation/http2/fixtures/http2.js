/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createHttp2ResponseServer

const http = require('http2')
const crypto = require('crypto')
const { Readable } = require('stream')

/**
 * Creates a new HTTP server to serve responses for HTTP2 requests.
 * The returned server is listening on `localhost` and a random port.
 *
 * @returns {Promise<object>} Has `server`, `host`, `port`, `baseUrl`,
 * and `responses` properties.
 */
function createHttp2ResponseServer() {
  const server = http.createServer(handler)
  const sockets = new Set()

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    socket.once('error', (err) => {
      console.error('server error', err)
      server.destroy(err)
    })
  })
  server.destroy = function destroy() {
    sockets.forEach((s) => s.destroy())
    server.close()
  }
  server.on('stream', (stream) => {
    sockets.add(stream)
    stream.on('close', () => {
      sockets.delete(stream)
    })
  })
  server.on('error', (stream) => {
    stream.end()
    server.close()
    sockets.delete(stream)
  })

  return new Promise((resolve, reject) => {
    server.listen({ host: '127.0.0.1', port: 0 }, (error) => {
      if (error) {
        return reject(error)
      }

      const addy = server.address()
      return resolve({
        server,
        host: addy.address,
        port: addy.port,
        baseUrl: `http://${addy.address}:${addy.port}`
      })
    })
  })
}

function parsePath(headers) {
  const path = headers[':path']
  const authority = headers[':authority']
  const protocol = headers[':scheme']
  if (!path) {
    return false
  }
  const url = new URL(`${protocol}://${authority}${path}`)
  return { pathname: url.pathname, searchParams: url.searchParams }
}

function handler(req, res) {
  let data = Buffer.alloc(0)
  let response = {}

  req.on('data', (chunk) => {
    data = Buffer.concat([data, chunk])
  })
  req.on('error', (err) => {
    response = {
      statusCode: 500,
      body: err
    }
  })

  req.on('end', () => {
    let shouldError = false
    let payload = {}
    if (data.length && data.length > 0) {
      payload = JSON.parse(data.toString('utf8'))
    }
    response = {
      statusCode: 200,
      body: payload
    }

    const path = parsePath(req.headers)
    if (path.pathname === '/errorCode') {
      response.statusCode = path.searchParams.get('code')
      const message = path.searchParams.get('reason')
      response.body = message ? message : 'Error triggered by test request'
      shouldError = true
    } else if (path.pathname === '/destroy') {
      response.statusCode = 500
      response.body = 'Destroying stream'
      shouldError = true
    }

    res.statusCode = response.statusCode

    // Echo back incoming headers to test which ones we add, particularly
    // 'traceparent', 'x-newrelic-transaction'
    // but also 'tracestate', synthetics, 'content-type', 'referer', 'user-agent'
    for (const [key, value] of Object.entries(req.headers)) {
      if (key[0] !== ':') { // can't set pseudoheaders
        try {
          res.setHeader(key, value)
        } catch (e) {
          console.error(`Unable to set header ${key}`, e)
        }
      }
    }

    if (shouldError) {
      res.destroy(response.body, response.statusCode)
    }

    if (payload?.data === 'infinite stream') {
      const stream = infiniteStream()
      let count = 0
      stream.on('data', () => {
        if (count >= 100) {
          stream.destroy()
          res.destroy()
        }
        count += 1
      })
      stream.pipe(res)
      return
    }

    res.end(JSON.stringify(response.body))
  })
}

/**
 * Creates a stream that will generate new stream messages until the stream
 * is destroyed.
 *
 * @returns {Readable} readable stream
 */
function infiniteStream() {
  return new Readable({
    read(size = 16) {
      const data = crypto.randomBytes(size)
      this.push(JSON.stringify({ chunk: { bytes: data.toString('base64') } }))
    }
  }).pause()
}
