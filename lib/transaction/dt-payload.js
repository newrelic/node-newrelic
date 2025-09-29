/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'distributedTracePayload' })

const DT_VERSION_MAJOR = 0
const DT_VERSION_MINOR = 1

module.exports = class DistributedTracePayload {
  /**
   * The class responsible for producing distributed trace payloads.
   * Created by calling {@link TransactionHandle#_createDistributedTracePayload}.
   *
   * @param {object} payload DT payload
   * @class
   */
  constructor(payload) {
    logger.trace('DistributedTracePayload created with %s', payload)
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
    logger.trace('DistributedTracePayload text: %s', this.plainTextPayload)
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
    logger.trace('DistributedTracePayload httpSafe: %s', this.base64Payload)
    return this.base64Payload
  }
}

module.exports.Stub = class DistributedTracePayloadStub {
  text() {
    logger.debug('DistributedTracePayloadStub text')
    return ''
  }

  httpSafe() {
    logger.debug('DistributedTracePayloadStub httpSafe')
    return ''
  }
}
