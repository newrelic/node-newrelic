'use strict'

const CollectorResponse = require('./response')
const logger = require('../logger').child({component: 'serverless_collector'})
const zlib = require('zlib')

const PAYLOAD_VERSION = 1
const PAYLOAD_MARKER = 'NR_LAMBDA_MONITORING'

class ServerlessCollector {
  /**
   * Constructs a new serverless collector instance with the give agent.
   *
   * @constructor
   * @classdesc
   *  A helper class for wrapping modules with segments
   *
   * @param {Agent} agent - The agent this collector will use
   */
  constructor(agent) {
    this._agent = agent
    this.enabled = true
    this.metadata = {
      arn: null,
      execution_environment: process.env.AWS_EXECUTION_ENV,
      protocol_version: 16,
      agent_version: agent.version
    }
    this.payload = {}
  }

  /**
   * Sets the ARN to be sent up in the metadata.
   */
  setLambdaArn(arn) {
    this.metadata.arn = arn
  }

  /**
   * Checks if the collector is currently collecting.
   *
   * @returns {boolean} If the collector is currently active.
   */
  isConnected() {
    return this.enabled
  }

  /**
   * Halts data collection.
   *
   * @param {Function} cb The callback to invoke upon disabling the collector.
   */
  shutdown(cb) {
    this.enabled = false
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * There is nothing to actually restart for serverless, so we do nothing.
   */
  restart(cb) {
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records metric data to be serialized.
   *
   * @param {Array} payload The metric data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  metricData(payload, cb) {
    if (this.enabled) {
      this.payload.metric_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records error trace data to be serialized.
   *
   * @param {Array} payload The error trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  errorData(payload, cb) {
    if (this.enabled) {
      this.payload.error_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records transaction trace data to be serialized.
   *
   * @param {Array} payload The transaction trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  transactionSampleData(payload, cb) {
    if (this.enabled) {
      this.payload.transaction_sample_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records transaction event data to be serialized.
   *
   * @param {Array} payload The transaction event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  analyticsEvents(payload, cb) {
    if (this.enabled) {
      this.payload.analytic_event_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records custom event data to be serialized.
   *
   * @param {Array} payload The custom event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  customEvents(payload, cb) {
    if (this.enabled) {
      this.payload.custom_event_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records SQL trace data to be serialized.
   *
   * @param {Array} payload The SQL trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  queryData(payload, cb) {
    if (this.enabled) {
      this.payload.sql_trace_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records error event data to be serialized.
   *
   * @param {Array} payload The error event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  errorEvents(payload, cb) {
    if (this.enabled) {
      this.payload.error_event_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Records span event data to be serialized.
   *
   * @param {Array} payload The span event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  spanEvents(payload, cb) {
    if (this.enabled) {
      this.payload.span_event_data = payload
    }
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * Constructs, serializes, and prints the final consolidated payload to stdout.
   *
   * @param {Function} cb The callback to invoke when finished.
   */
  flushPayload(cb) {
    if (!this.enabled) {
      return cb && setImmediate(cb)
    }

    const toFlush = JSON.stringify({
      metadata: this.metadata,
      data: this.payload
    })

    const collector = this
    zlib.gzip(toFlush, function flushCompressed(err, compressed) {
      collector.payload = {}

      if (err) {
        logger.warn('Encountered an error while attempting to compress payload', err)
        return cb && cb(err)
      }

      const serializedPayload = JSON.stringify([
        PAYLOAD_VERSION,
        PAYLOAD_MARKER,
        compressed.toString('base64')
      ]) + '\n'
      process.stdout.write(serializedPayload)

      cb && cb()
    })
  }
}

module.exports = ServerlessCollector
