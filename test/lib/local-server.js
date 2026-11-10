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
 * @returns {Promise<object>} Resolves to
 * `{ server, origin, host, port, cert }`. `cert` is the PEM certificate
 * string when `opts.secure` is true, otherwise `undefined`.
 */
async function startServer(handler, { secure = false } = {}) {
  let server
  let cert
  if (secure) {
    const generated = fakeCert()
    cert = generated.certificate
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
  return { server, origin, host, port, cert }
}

module.exports = { startServer }
