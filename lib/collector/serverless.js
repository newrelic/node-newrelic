/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const CollectorResponse = require('./response')
const logger = require('../logger').child({ component: 'serverless_collector' })
const zlib = require('zlib')
const fs = require('fs')
const stringify = require('json-stringify-safe')

const PAYLOAD_VERSION = 1
const PAYLOAD_MARKER = 'NR_LAMBDA_MONITORING'

const path = require('path')
const defaultPipePath = path.resolve('/tmp', 'newrelic-telemetry')

/* eslint-disable camelcase */
class ServerlessCollector {
  /**
   * Constructs a new serverless collector instance with the give agent.
   *
   * @class
   * @classdesc
   *  A helper class for wrapping modules with segments
   * @param {Agent} agent - The agent this collector will use
   * @param {string} pipePath path of the named pipe to the Lambda extension, if it's enabled
   */
  constructor(agent, pipePath) {
    this._agent = agent
    this.enabled = true
    this.metadata = {
      arn: null,
      function_version: null,
      execution_environment: process.env.AWS_EXECUTION_ENV,
      protocol_version: 16,
      agent_version: agent.version
    }
    this.payload = {}
    this.pipePath = pipePath || process.env.NEWRELIC_PIPE_PATH || defaultPipePath
  }

  /**
   * Sets the ARN to be sent up in the metadata.
   *
   * @param {string} arn Amazon Resource Name of the function
   */
  setLambdaArn(arn) {
    this.metadata.arn = arn
  }

  /**
   * Sets the function_version to be sent up in the metadata.
   *
   * @param {string} function_version version indicator for Lambda function
   */
  setLambdaFunctionVersion(function_version) {
    this.metadata.function_version = function_version
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
    logger.trace('Disabling serverless collector.')

    this.enabled = false
    setImmediate(cb, null, CollectorResponse.success(null))
  }

  /**
   * There is nothing to actually restart for serverless, so we do nothing.
   *
   * @param {Function} cb callback function, if any
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
  metric_data(payload, cb) {
    if (this.enabled) {
      this.payload.metric_data = payload
    }

    cb(null, { retainData: false })
  }

  /**
   * Records error trace data to be serialized.
   *
   * @param {Array} payload The error trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  error_data(payload, cb) {
    if (this.enabled) {
      this.payload.error_data = payload
    }

    cb(null, { retainData: false })
  }

  /**
   * Records error event data to be serialized.
   *
   * @param {Array} payload The error event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  error_event_data(payload, cb) {
    if (this.enabled) {
      this.payload.error_event_data = payload
    }

    cb(null, { retainData: false })
  }

  /**
   * Records transaction trace data to be serialized.
   *
   * @param {Array} payload The transaction trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  transaction_sample_data(payload, cb) {
    if (this.enabled) {
      this.payload.transaction_sample_data = payload
    }
    cb(null, { retainData: false })
  }

  /**
   * Records transaction event data to be serialized.
   *
   * @param {Array} payload The transaction event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  analytic_event_data(payload, cb) {
    if (this.enabled) {
      this.payload.analytic_event_data = payload
    }

    cb(null, { retainData: false })
  }

  /**
   * Records custom event data to be serialized.
   *
   * @param {Array} payload The custom event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  custom_event_data(payload, cb) {
    if (this.enabled) {
      this.payload.custom_event_data = payload
    }

    cb(null, { retainData: false })
  }

  /**
   * Records SQL trace data to be serialized.
   *
   * @param {Array} payload The SQL trace data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  sql_trace_data(payload, cb) {
    if (this.enabled) {
      this.payload.sql_trace_data = payload
    }
    cb(null, { retainData: false })
  }

  /**
   * Records span event data to be serialized.
   *
   * @param {Array} payload The span event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  span_event_data(payload, cb) {
    if (this.enabled) {
      this.payload.span_event_data = payload
    }
    cb(null, { retainData: false })
  }

  /**
   * Records log event data to be serialized.
   *
   * @param {Array} payload The log event data payload to serialize.
   * @param {Function} cb The callback to invoke when finished.
   */
  log_event_data(payload, cb) {
    if (this.enabled) {
      this.payload.log_event_data = payload
    }
    cb(null, { retainData: false })
  }

  /**
   * Constructs, serializes, and prints the final consolidated payload to stdout.
   *
   * @param {Function} cb The callback to invoke when finished.
   * @returns {boolean} indicating if callback was defined and successfully executed
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
    // Per serverless spec, this payload is always gzipped
    zlib.gzip(toFlush, function flushCompressed(err, compressed) {
      collector.payload = {}

      if (err) {
        logger.warn('Encountered an error while attempting to compress payload', err)
        return cb && cb(err)
      }

      collector._doFlush(compressed.toString('base64'))

      cb && cb()
    })
  }

  /**
   * Constructs, serializes, and prints the final consolidated payload to
   * stdout synchronously.
   */
  flushPayloadSync() {
    if (!this.enabled) {
      return
    }

    const toFlush = stringify({
      metadata: this.metadata,
      data: this.payload
    })

    try {
      // Per serverless spec, this payload is always gzipped
      this._doFlush(zlib.gzipSync(toFlush).toString('base64'), true)
    } catch (err) {
      logger.warn('Encountered an error while attempting to compress payload', err)
    } finally {
      this.payload = Object.create(null)
    }
  }

  /**
   * Writes payload to pipe
   *
   * @param {string} payload serialized stringified-JSON payload to flush
   * @returns {boolean} whether or not flush was successful
   */
  flushToPipeSync(payload) {
    try {
      fs.writeFileSync(this.pipePath, payload)
      return true
    } catch (e) {
      logger.warn('Error attempting to write to pipe, falling back to stdout', e)
      return false
    }
  }

  flushToStdOut(serializedPayload, payloadLength, sync = false) {
    if (sync) {
      // Long log lines have been truncated at 65538
      // Guarantees process.stdout will block, so long logs
      // won't be truncated if process.exit() is called early.
      const s = process.stdout
      payloadLength > 65000 && s._handle && s._handle.setBlocking && s._handle.setBlocking(true)

      fs.writeSync(process.stdout.fd, serializedPayload)
    } else {
      process.stdout.write(serializedPayload)
    }
  }

  /**
   * Internal method to handle flushing to stdout.
   *
   * @private
   * @param {string} payload The payload to flush.
   * @param {boolean} sync Whether to write to stdout synchronously.
   */
  _doFlush(payload, sync = false) {
    const serializedPayload = JSON.stringify([PAYLOAD_VERSION, PAYLOAD_MARKER, payload]) + '\n'

    const didUsePipe = fs.existsSync(this.pipePath) && this.flushToPipeSync(serializedPayload)

    if (!didUsePipe) {
      this.flushToStdOut(serializedPayload, payload.length, sync)
    }
  }
}

module.exports = ServerlessCollector
/* eslint-enable camelcase */
