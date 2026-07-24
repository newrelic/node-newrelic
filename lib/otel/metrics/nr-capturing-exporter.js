/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  ExportResultCode
} = require('@opentelemetry/core')
const {
  ProtobufMetricsSerializer
} = require('@opentelemetry/otlp-transformer')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'nr-capturing-exporter'
})

/**
 * Implements the required bits of the `PushMetricExporter` interface. Such an
 * exporter is the entrypoint to the metrics collection/harvest process. By
 * providing our own implementation, we are able to serialize the data to
 * a protobuf array and collect it without incurring a network operation.
 *
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-metrics.PushMetricExporter.html
 */
class NRCapturingExporter {
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

  constructor({ logger = defaultLogger } = {}) {
    this.#logger = logger.child({ subcomponent: this.constructor.name })
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

  export(metrics, callback) {
    const serialized = ProtobufMetricsSerializer.serializeRequest(metrics)
    const buffer = Buffer.from(serialized)
    this.#lastSerialization = buffer.toString('base64')

    this.#logger.audit(
      {
        destUrl: 'local capture',
        data: this.#lastSerialization,
        bytes: buffer.byteLength
      },
      'Serialized metrics data.'
    )

    callback({ code: ExportResultCode.SUCCESS })
  }

  forceFlush() { return Promise.resolve() }

  shutdown() { return Promise.resolve() }
}

module.exports = NRCapturingExporter
