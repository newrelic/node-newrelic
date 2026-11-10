/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const net = require('node:net')
const tls = require('node:tls')
const fakeCert = require('./fake-cert')

/**
 * A minimal, real forward-HTTP-CONNECT proxy for exercising
 * `lib/collector/http-agents.js`'s `proxyAgent` (backed by the
 * `https-proxy-agent` package). The connection to the proxy
 * itself is TLS-terminated (matching `http-agents.js#buildProxyUrl`, which
 * always builds an `https://` proxy URL when using `proxy_host`/
 * `proxy_port`), using a fresh self-signed certificate -- tests must set
 * `NODE_TLS_REJECT_UNAUTHORIZED=0` for the client to accept it, same as the
 * existing precedent in test/unit/collector/remote-method.test.js.
 *
 * The first `failTunnels` CONNECT requests (received in plaintext, once the
 * proxy-leg TLS is established) are accepted (`200 Connection Established`)
 * but then fed non-TLS garbage the instant the client starts the *nested*
 * TLS handshake for the ultimate destination, which reliably produces a
 * real `EPROTO` client error. Every tunnel after that is proxied for real: a
 * genuine TCP connection is opened to the CONNECT target (parsed off the
 * request line) and bytes are piped bidirectionally.
 */
class FakeProxyServer {
  #server
  #address
  #failTunnels
  #tunnelCount = 0
  #cert

  constructor({ failTunnels = 1 } = {}) {
    this.#failTunnels = failTunnels
    this.#cert = fakeCert()
    this.#server = tls.createServer(
      { key: this.#cert.privateKey, cert: this.#cert.certificate },
      (socket) => this.#onConnection(socket)
    )
    this.#server.unref()
  }

  /**
   * Resets the count of tunnels established so far, so a test can reuse
   * the same proxy (and thus the same `host`/`port` the agent's
   * process-wide proxy-agent singleton has already cached) while still
   * getting a fresh "first tunnel fails" sequence.
   */
  resetTunnelCount() {
    this.#tunnelCount = 0
  }

  #onConnection(socket) {
    let buffered = Buffer.alloc(0)
    const onData = (chunk) => {
      buffered = Buffer.concat([buffered, chunk])
      const headerEnd = buffered.indexOf('\r\n\r\n')
      if (headerEnd === -1) {
        return
      }
      socket.removeListener('data', onData)

      const requestLine = buffered.toString('utf8', 0, buffered.indexOf('\r\n'))
      const [, target] = requestLine.split(' ')
      const [targetHost, targetPort] = target.split(':')

      this.#tunnelCount += 1
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

      if (this.#tunnelCount <= this.#failTunnels) {
        socket.once('data', () => {
          socket.write('not a tls server hello, just plain garbage bytes to break the handshake')
        })
        // The client aborts once it sees the broken handshake; swallow the
        // resulting ECONNRESET/EPROTO on this side, it is expected.
        socket.on('error', () => {})
        return
      }

      const upstream = net.connect({ host: targetHost, port: Number(targetPort) }, () => {
        socket.pipe(upstream)
        upstream.pipe(socket)
      })
      upstream.on('error', () => socket.destroy())
      socket.on('error', () => upstream.destroy())
    }
    socket.on('data', onData)
  }

  /**
   * @returns {Promise<object>} Resolves to a standard server address object.
   */
  async listen() {
    await new Promise((resolve, reject) => {
      this.#server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()))
    })
    this.#address = this.#server.address()
    return this.#address
  }

  get host() {
    return this.#address?.address
  }

  get port() {
    return this.#address?.port
  }

  close() {
    this.#server.close()
  }
}

module.exports = FakeProxyServer
