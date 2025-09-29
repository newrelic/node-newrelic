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
const CollectorValidators = require('./test-collector-validators')

/**
 * Extends {@link http.IncomingMessage} with convenience properties and methods.
 * @typedef {object} CollectorIncomingRequest
 * @property {object} query The parsed query string.
 * @property {Function} body A function that returns a promise resolving to the request body.
 * @property {Function} getHeader A function that returns the value of a specific header.
 */

/**
 * Extends {@link http.OutgoingMessage} with convenience properties and methods.
 * @typedef {object} CollectorOutgoingResponse
 * @property {Function} json A function that sends a JSON response.
 */

/**
 * Emulates the New Relic collector. Provides convenience methods that make
 * writing tests against collector processing easier.
 */
class Collector {
  #handlers = new Map()
  #cert
  #server
  #address
  #runId
  #validators = new CollectorValidators()

  constructor({ runId = 42 } = {}) {
    this.#cert = fakeCert()
    this.#runId = runId
    this.#server = https.createServer({
      key: this.#cert.privateKey,
      cert: this.#cert.certificate
    })
    this.#server.on('request', (req, res) => {
      const qs = querystring.decode(req.url.slice(req.url.indexOf('?') + 1))
      const handler = this.#handlers.get(qs.method)
      if (typeof handler !== 'function') {
        res.writeHead(500)
        return res.end('handler not found: ' + req.url)
      }

      /**
       * Send the response as serialized JSON.
       *
       * @param {object} params params object
       * @param {object} params.payload The object to serialize into a response.
       * @param {number} [params.code] The status code to use for the
       * response.
       * @memberof CollectorOutgoingResponse
       */
      res.json = function ({ payload, code = 200 }) {
        this.writeHead(code, { 'content-type': 'application/json' })
        this.end(JSON.stringify(payload))
      }

      /**
       * The query string associated with the request, parsed into an object.
       * @type {object}
       * @memberof CollectorIncomingRequest
       */
      req.query = qs

      /**
       * Retrieve the body of a POST-like request.
       *
       * @memberof CollectorIncomingRequest
       * @returns {Promise<string>} The body of an incoming POST-like request
       * collected as a string.
       */
      req.body = function () {
        let resolve
        let reject
        const promise = new Promise((_resolve, _reject) => {
          resolve = _resolve
          reject = _reject
        })

        let data = ''
        this.on('data', (d) => {
          data += d
        })
        this.on('end', () => {
          resolve(data)
        })
        this.on('error', (error) => {
          reject(error)
        })
        return promise
      }

      /**
       * Get the value of a specific header.
       *
       * @memberof CollectorIncomingRequest
       * @param {string} name header name
       * @returns {*}
       */
      req.getHeader = function (name) {
        return req.headers[name.toLowerCase()]
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
    return this.#cert.certificate
  }

  /**
   * The most basic `agent_settings` handler. Useful when you do not need to
   * customize the handler.
   *
   * @returns {Function}
   */
  get agentSettingsHandler() {
    return function (req, res) {
      res.json({ payload: { return_value: [] } })
    }
  }

  /**
   * the most basic `connect` handler. Useful when you do not need to
   * customize the handler.
   *
   * @returns {Function}
   */
  get connectHandler() {
    const runId = this.#runId
    return function (req, res) {
      res.json({ payload: { return_value: { agent_run_id: runId } } })
    }
  }

  /**
   * The most basic `preconnect` handler. Useful when you do not need to
   * customize the handler.
   *
   * @returns {Function}
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
   * A set of validation functions that can be used to verify specific
   * aspects of HTTP requests match expectation.
   *
   * @returns {CollectorValidators}
   */
  get validators() {
    return this.#validators
  }

  /**
   * Adds a new handler for the provided endpoint.
   *
   * @param {string} endpoint A string like
   * `/agent_listener/invoke_raw_method?method=preconnect`. Notice that a query
   * string with the `method` parameter is present. This is required, as the
   * value of `method` will be used to look up the handler when receiving
   * requests.
   * @param {Function} handler A typical `(req, res) => {}` handler. For
   * convenience, `res` is extended with a `json({ payload, code = 200 })`
   * method for easily sending JSON responses. Also, `req` is extended with
   * a `body()` method that returns a promise which resolves to the string
   * data supplied via POST-like requests.
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
    this.addHandler(helper.generateCollectorPath('preconnect', this.#runId), this.preconnectHandler)
    this.addHandler(helper.generateCollectorPath('connect', this.#runId), this.connectHandler)
    this.addHandler(
      helper.generateCollectorPath('agent_settings', this.#runId),
      this.agentSettingsHandler
    )

    return address
  }
}

module.exports = Collector
