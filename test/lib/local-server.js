/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')
const https = require('node:https')
const fakeCert = require('./fake-cert')

/**
 * Starts a bare local HTTP or HTTPS server bound to an ephemeral port on
 * 127.0.0.1, for tests that exercise the agent's own outbound-HTTP-client
 * instrumentation. There is no routing DSL -- supply a standard
 * `(req, res) => {}` handler and branch on `req.method`/`req.url` yourself.
 *
 * @param {Function} handler Standard `(req, res) => {}` request handler.
 * @param {object} [opts] Options object.
 * @param {boolean} [opts.secure] When true, uses `https.createServer` with
 * a fresh self-signed certificate (see test/lib/fake-cert.js).
 * @param {object} [opts.cert] A cert from `./fake-cert`
 * (`{privateKey, certificate}` PEM strings) to use instead of an
 * auto-generated one -- useful when a specific common name is needed.
 * Ignored when `secure` is `false`.
 * @returns {Promise<object>} Resolves to
 * `{ server, origin, host, port, cert }`. `cert` is the PEM certificate
 * string when `opts.secure` is true, otherwise `undefined`.
 */
async function startServer(handler, { secure = false, cert } = {}) {
  let server
  let certPem
  if (secure) {
    const generated = cert || fakeCert()
    certPem = generated.certificate
    server = https.createServer({ key: generated.privateKey, cert: generated.certificate }, handler)
  } else {
    server = http.createServer(handler)
  }
  server.unref()

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()))
  })

  const { address: host, port } = server.address()
  const origin = `${secure ? 'https' : 'http'}://${host}:${port}`
  return { server, origin, host, port, cert: certPem }
}

/**
 * A default `(req, res) => {}` handler covering the request shapes commonly
 * exercised by outbound-HTTP-client instrumentation tests.
 *
 * - `/delay/<ms>` -- responds `200 'ok'` after the given delay.
 * - `/status/<code>` -- responds with the given status code, empty body.
 * - `/headers` -- responds `200` with a JSON echo of the request headers.
 * - anything else -- responds `200 'ok'`.
 *
 * @param {http.IncomingMessage} req Incoming request.
 * @param {http.ServerResponse} res Response to write to.
 */
function defaultRoutesHandler(req, res) {
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
}

module.exports = { startServer, defaultRoutesHandler }
