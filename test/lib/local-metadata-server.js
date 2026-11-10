/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')

/**
 * A minimal method+path-routed local HTTP server standing in for
 * cloud-provider instance-metadata endpoints (AWS IMDSv2, Azure IMDS, GCP
 * metadata server). Routing ignores query strings and does not consider
 * headers -- handlers receive the real `req` so they can assert on headers
 * themselves (e.g. IMDSv2's `X-aws-ec2-metadata-token` or GCP's
 * `Metadata-Flavor: Google`).
 */
class LocalMetadataServer {
  #server
  #routes = new Map()
  #address

  constructor() {
    this.#server = http.createServer((req, res) => this.#onRequest(req, res))
    this.#server.unref()
  }

  #key(method, path) {
    return `${method.toUpperCase()} ${path}`
  }

  #onRequest(req, res) {
    const [path] = req.url.split('?')
    const route = this.#routes.get(this.#key(req.method, path))
    if (!route) {
      res.writeHead(404)
      res.end(`no route for ${req.method} ${req.url}`)
      return
    }
    route.isDone = true
    route.handler(req, res)
  }

  /**
   * @param {string} method HTTP method, e.g. `'GET'`.
   * @param {string} path Path without query string, e.g. `'/latest/api/token'`.
   * @param {Function} handler Standard `(req, res) => {}` request handler.
   * @returns {object} `{ isDone() }` -- true once the route has been hit.
   */
  addRoute(method, path, handler) {
    const key = this.#key(method, path)
    const route = { handler, isDone: false }
    this.#routes.set(key, route)
    return { isDone: () => route.isDone }
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

  get hostPort() {
    return `${this.host}:${this.port}`
  }

  close() {
    this.#server.closeAllConnections()
  }
}

module.exports = LocalMetadataServer
