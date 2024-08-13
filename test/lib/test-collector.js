/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This provides an in-process http server to use in place of
// collector.newrelic.com. It allows for custom handlers so that test specific
// assertions can be made.

const https = require('node:https')
const querystring = require('node:querystring')
const helper = require('./agent_helper')
const fakeCert = require('./fake-cert')

class Collector {
  #handlers = new Map()
  #server
  #address

  constructor() {
    this.#server = https.createServer({
      key: fakeCert.privateKey,
      cert: fakeCert.certificate
    })
    this.#server.on('request', (req, res) => {
      const qs = querystring.decode(req.url.slice(req.url.indexOf('?') + 1))
      const handler = this.#handlers.get(qs.method)
      if (typeof handler !== 'function') {
        res.writeHead(500)
        return res.end('handler not found: ' + req.url)
      }

      res.json = function ({ payload, code = 200 }) {
        this.writeHead(code, { 'content-type': 'application/json' })
        this.end(JSON.stringify(payload))
      }

      handler.isDone = true
      handler(req, res)
    })

    // We don't need this server keeping the process alive.
    this.#server.unref()
  }

  /**
   * A configuration object that can be passed to an "agent" instance so that
   * the agent will communicate with this test server instead of the real
   * server.
   *
   * Important: the `.listen` method must be invoked first in order to have
   * the `host` and `port` defined.
   *
   * @returns {object}
   */
  get agentConfig() {
    return {
      host: this.host,
      port: this.port,
      license_key: 'testing',
      certificates: [this.cert]
    }
  }

  /**
   * The host the server is listening on.
   *
   * @returns {string}
   */
  get host() {
    return this.#address?.address
  }

  /**
   * The port number the server is listening on.
   *
   * @returns {number}
   */
  get port() {
    return this.#address?.port
  }

  /**
   * A copy of the public certificate used to secure the server. Use this
   * like `new Agent({ certificates: [collector.cert] })`.
   *
   * @returns {string}
   */
  get cert() {
    return fakeCert.certificate
  }

  /**
   * The most basic `agent_settings` handler. Useful when you do not need to
   * customize the handler.
   *
   * @returns {function}
   */
  get agentSettingsHandler() {
    return function (req, res) {
      res.json({ payload: { return_value: [] } })
    }
  }

  /**
   * The most basic `preconnect` handler. Useful when you do not need to
   * customize the handler.
   *
   * @returns {function}
   */
  get preconnectHandler() {
    const host = this.host
    const port = this.port
    return function (req, res) {
      res.json({
        payload: {
          return_value: {
            redirect_host: `${host}:${port}`,
            security_policies: {}
          }
        }
      })
    }
  }

  /**
   * Adds a new handler for the provided endpoint.
   *
   * @param {string} endpoint A string like
   * `/agent_listener/invoke_raw_method?method=preconnect`. Notice that a query
   * string with the `method` parameter is present. This is required, as the
   * value of `method` will be used to look up the handler when receiving
   * requests.
   * @param {function} handler A typical `(req, res) => {}` handler. For
   * convenience, `res` is extended with a `json({ payload, code = 200 })`
   * method for easily sending JSON responses.
   */
  addHandler(endpoint, handler) {
    const qs = querystring.decode(endpoint.slice(endpoint.indexOf('?') + 1))
    this.#handlers.set(qs.method, handler)
  }

  /**
   * Shutdown the server and forcefully close all current connections.
   */
  close() {
    this.#server.closeAllConnections()
  }

  /**
   * Determine if a handler has been invoked.
   *
   * @param {string} method Name of the method to check, e.g. "preconnect".
   * @returns {boolean}
   */
  isDone(method) {
    return this.#handlers.get(method)?.isDone === true
  }

  /**
   * Start the server listening for requests.
   *
   * @returns {Promise<object>} Returns a standard server address object.
   */
  async listen() {
    let address
    await new Promise((resolve, reject) => {
      this.#server.listen(0, '127.0.0.1', (err) => {
        if (err) {
          return reject(err)
        }
        address = this.#server.address()
        resolve()
      })
    })

    this.#address = address

    // Add handlers for the required agent startup connections. These should
    // be overwritten by tests that exercise the startup phase, but adding these
    // stubs makes it easier to test other connection events.
    this.addHandler(helper.generateCollectorPath('preconnect', 42), this.preconnectHandler)
    this.addHandler(helper.generateCollectorPath('connect', 42), (req, res) => {
      res.json({ payload: { return_value: { agent_run_id: 42 } } })
    })
    this.addHandler(helper.generateCollectorPath('agent_settings', 42), this.agentSettingsHandler)

    return address
  }
}

module.exports = Collector
