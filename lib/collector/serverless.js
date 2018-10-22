'use strict'

const zlib = require('zlib')
const logger = require('../logger').child({component: 'serverless_collector'})

const PAYLOAD_VERSION = 1
const PAYLOAD_MARKER = 'NR_LAMBDA_MONITORING'

class ServerlessCollector {
  constructor(agent) {
    this._agent = agent
    this.enabled = true
    this.metadata = {
      arn: agent.lambdaArn,
      execution_environment: process.env.AWS_EXECUTION_ENV,
      protocol_version: 16,
      agent_version: agent.version
    }
    this.payload = {}
  }

  isConnected() {
    return true
  }

  shutdown(cb) {
    this.enabled = false
    setImmediate(cb)
  }

  metricData(payload, cb) {
    this.payload.metric_data = payload
    setImmediate(cb)
  }

  errorData(payload, cb) {
    this.payload.error_data = payload
    setImmediate(cb)
  }

  transactionSampleData(payload, cb) {
    this.payload.transaction_sample_data = payload
    setImmediate(cb)
  }

  analyticsEvents(payload, cb) {
    this.payload.analytic_event_data = payload
    setImmediate(cb)
  }

  customEvents(payload, cb) {
    this.payload.custom_event_data = payload
    setImmediate(cb)
  }

  queryData(payload, cb) {
    this.payload.sql_trace_data = payload
    setImmediate(cb)
  }

  errorEvents(payload, cb) {
    this.payload.error_event_data = payload
    setImmediate(cb)
  }

  spanEvents(payload, cb) {
    this.payload.span_event_data = payload
    setImmediate(cb)
  }
  flushPayload(cb) {
    const toFlush = JSON.stringify({
      metadata: this.metadata,
      data: this.payload
    })

    const collector = this
    zlib.gzip(toFlush, function flushCompressed(err, compressed) {
      collector.payload = {}

      if (err) {
        logger.warn('Encountered an error while attempting to compress payload', err)
        return cb(err)
      }

      /* eslint-disable no-console */
      console.log([PAYLOAD_VERSION, PAYLOAD_MARKER, compressed.toString('base64')])
      /* eslint-enable no-console */

      cb()
    })
  }
}

module.exports = ServerlessCollector
