/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'new_relic_response' })

/**
 * The collector has many ways of indicating failure, and isn't
 * necessarily consistent. Because there can either be a failure at
 * the network level, a nonstandard HTTP status code on the response,
 * or a JSON-encoded exception in the response body, there's a lot of
 * conditional logic in here that tries to grab as much information
 * about errors as possible, and to parse out the return value as often
 * as possible.
 *
 * @param string         name     Remote method name that was invoked.
 * @param ServerResponse response HTTP response stream
 * @param Function       callback Function that will be called with any
 *                                error, the value returned by the server
 *                                (if any), and the raw JSON of the
 *                                server's response.
 * @param name
 * @param response
 * @param callback
 * @returns Function Another callback that is meant to be invoked with
 *                   any errors from reading the response stream, as
 *                   well as a string containing the full response.
 */
module.exports = function parse(name, response, callback) {
  if (!callback) {
    throw new TypeError('callback required!')
  }
  if (!name) {
    return callback(new TypeError('collector method name required!'))
  }
  if (!response) {
    return callback(new TypeError('HTTP response required!'))
  }

  return function parser(error, body) {
    if (error) {
      return setImmediate(() => callback(error))
    }

    let payload = null

    if (body) {
      try {
        const json = JSON.parse(body)

        // Can be super verbose, but useful for debugging.
        logger.trace(json, 'Deserialized from collector:')

        payload = json.return_value || payload
      } catch (err) {
        logger.warn(err, 'Could not parse response from the collector: %s', body)
      }
    }

    const res = {
      status: response.statusCode,
      payload
    }

    setImmediate(() => callback(null, res))
  }
}
