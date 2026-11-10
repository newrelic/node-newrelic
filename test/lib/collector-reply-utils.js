/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('./agent_helper')

/**
 * Pre-stringifies a JSON body and returns [body, headers] suitable for spreading
 * into `collector.addHandler`'s `res.writeHead(status, headers)`.
 *
 * @param {object} body The response body to serialize.
 * @returns {Array} Tuple of [stringified body, headers object].
 */
function jsonReply(body) {
  const str = JSON.stringify(body)
  return [str, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(str) }]
}

/**
 * Returns a `mockRequest(endpointMethod, runId)` function bound to a
 * specific, already-listening `Collector` instance (see
 * test/lib/test-collector.js).
 *
 * @param {object} collector A listening `Collector` instance.
 * @returns {Function} `mockRequest(endpointMethod, runId)` bound to `collector`.
 */
function createMockRequest(collector) {
  return function mockRequest(endpointMethod, runId) {
    const endpoint = helper.generateCollectorPath(endpointMethod, runId)
    const interceptor = {
      reply(statusCode, body, headers = {}) {
        collector.addHandler(endpoint, (req, res) => {
          res.writeHead(statusCode, headers)
          res.end(body)
        })
        return interceptor
      },
      isDone() {
        return collector.isDone(endpointMethod)
      }
    }
    return interceptor
  }
}

/**
 * Polls (via the un-faked `setImmediate`) until an endpoint's handler has
 * been invoked, or gives up after a generous number of event loop turns.
 * Needed because some collector calls (e.g. `agent_settings`, reported from
 * a fire-and-forget `config`-change listener) aren't awaited by anything in
 * the agent itself -- against a real server they can land a few event loop
 * turns after the response that triggered them.
 *
 * @param {object} endpoint One of the `{ isDone() }` objects returned by
 * `createMockRequest(...).reply(...)`.
 * @returns {Promise<void>}
 */
async function waitUntilDone(endpoint) {
  for (let i = 0; i < 50 && !endpoint.isDone(); i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

module.exports = { jsonReply, createMockRequest, waitUntilDone }
