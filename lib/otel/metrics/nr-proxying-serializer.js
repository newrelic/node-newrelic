/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  ProtobufMetricsSerializer
} = require('@opentelemetry/otlp-transformer')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'nr-proxying-serializer'
})

/**
 * A wrapper around the standard OpenTelemetry protobuf serializer to
 * intercept serializations and de-serializations so that we can write
 * audit logs.
 */
class NRProxyingSerializer {
  #awsLambdaMode
  #destinationUrl
  #logger

  /**
   * Used to cache the most recent serialization data as a Base64 encoded
   * string. We need a way to expose this data to the agent during harvest
   * time, so we simply cache it and allow the harvester to retrive it after
   * a successful exporter `.export` invocation.
   *
   * @type {string}
   */
  #lastSerialization = ''

  constructor({
    destinationUrl = null,
    logger = defaultLogger,
    awsLambdaMode = false
  } = {}) {
    this.#destinationUrl = destinationUrl
    this.#logger = logger.child({ subcomponent: this.constructor.name })
    this.#awsLambdaMode = awsLambdaMode
  }

  /**
   * Retrieve the most recent serialization data and purge the cache.
   *
   * @returns {string} Base64 encoded string that decodes to a protobuf array.
   */
  get lastSerialization() {
    const result = this.#lastSerialization
    this.#lastSerialization = ''
    return result
  }

  serializeRequest(metrics) {
    const serialized = ProtobufMetricsSerializer.serializeRequest(metrics)

    if (this.#awsLambdaMode === true || this.#logger.auditEnabled === true) {
      // We section this off because it is potentially expensive.
      // 1. We can't use `serialized.toBase64()` because that isn't avilable
      // untile Node.js >= 25.
      // 2. Using `new DataView(serialized)` to get the byte length would
      // still be necessary because `UInt8Array` doesn't have a byte length
      // field.
      // So it's a bit cheaper to use `Buffer`, but still expensive if we
      // don't need to log the information.
      const buffer = Buffer.from(serialized)
      this.#lastSerialization = buffer.toString('base64')

      this.#logger.audit(
        {
          destUrl: this.#destinationUrl,
          data: this.#lastSerialization,
          bytes: buffer.byteLength
        },
        'Serialized metrics data.'
      )
    }

    return serialized
  }

  deserializeResponse(data) {
    if (this.#logger.auditEnabled() === true) {
      this.#logger.audit(
        { data: Buffer.from(data).toString('base64') },
        'Received response data.'
      )
    }
    return ProtobufMetricsSerializer.deserializeResponse(data)
  }
}

module.exports = NRProxyingSerializer
