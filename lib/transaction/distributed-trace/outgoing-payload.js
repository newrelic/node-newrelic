/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({
  component: 'OutgoingPayload'
})

const DT_VERSION_MAJOR = 0
const DT_VERSION_MINOR = 1

/**
 * The class responsible for producing distributed trace payloads to be
 * sent in responses.
 *
 * @type {OutgoingPayload}
 */
class OutgoingPayload {
  #logger

  /**
   * @param {object} payload DT payload
   * @param {object} deps Injected dependencies
   * @param {AgentLogger} [deps.logger] Logger instance.
   */
  constructor(payload, { logger = defaultLogger } = {}) {
    this.#logger = logger

    this.#logger.trace('DistributedTracePayload created with %s', payload)
    this.plainTextPayload = JSON.stringify({
      v: [DT_VERSION_MAJOR, DT_VERSION_MINOR],
      d: payload
    })
    this.base64Payload = null
  }

  /**
   * @returns {string} The base64 encoded JSON representation of the
   * distributed trace payload.
   */
  text() {
    this.#logger.trace('DistributedTracePayload text: %s', this.plainTextPayload)
    return this.plainTextPayload
  }

  /**
   * Construct a payload suitable for HTTP transport.
   *
   * @returns {string} The base64 encoded JSON representation of the
   * distributed trace payload.
   */
  httpSafe() {
    if (!this.base64Payload) {
      this.base64Payload = Buffer.from(this.plainTextPayload, 'utf-8').toString('base64')
    }
    this.#logger.trace('DistributedTracePayload httpSafe: %s', this.base64Payload)
    return this.base64Payload
  }
}

class OutgoingPayloadStub {
  #logger

  constructor({ logger = defaultLogger } = {}) {
    this.#logger = logger
  }

  text() {
    this.#logger.debug('DistributedTracePayloadStub text')
    return ''
  }

  httpSafe() {
    this.#logger.debug('DistributedTracePayloadStub httpSafe')
    return ''
  }
}

module.exports = OutgoingPayload
module.exports.Stub = OutgoingPayloadStub
