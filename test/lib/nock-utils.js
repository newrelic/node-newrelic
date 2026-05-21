/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const nock = require('nock')
const helper = require('./agent_helper')

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`

/**
 * Pre-stringifies a JSON body and returns [body, headers] suitable for spreading
 * into nock's `.reply(status, body, headers)`. nock 14 does not set Content-Length
 * automatically; without it, keep-alive connections stall waiting for body termination.
 *
 * @param {object} body - The response body to serialize.
 * @returns {Array} Tuple of [stringified body, headers object] for use
 *   with nock's `.reply(status, ...jsonReply(body))`.
 */
function jsonReply(body) {
  const str = JSON.stringify(body)
  return [str, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(str) }]
}

/**
 * Creates a nock interceptor for a POST request to the test collector.
 *
 * @param {string} endpointMethod - The collector endpoint name (e.g. `'preconnect'`, `'connect'`).
 * @param {string} [runId] - The agent run ID to include in the request path, if applicable.
 * @param {object|Function} [bodyMatcher] - Optional nock body matcher to assert on request body.
 * @returns {Interceptor} A nock interceptor with `.reply()` not yet called.
 */
function nockRequest(endpointMethod, runId, bodyMatcher) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath, bodyMatcher)
}

module.exports = { jsonReply, nockRequest }
