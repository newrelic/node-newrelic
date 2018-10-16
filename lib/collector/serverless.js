'use strict'

const zlib = require('zlib')
const logger = require('../logger').child({component: 'serverless_collector'})
const pkg = require(`${process.cwd()}/package.json`)

class ServerlessCollector {
  constructor(agent) {
    this._agent = agent
    this.enabled = true
    this.metadata = {
      arn: process.env.AWS_LAMBDA_FUNCTION_ARN,
      execution_environment: process.env.AWS_EXECUTION_ENV,
      protocol_version: 16,
      agent_version: pkg.version,
      apdex_t: agent.config.apdex_t
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

  preparePayload() {
    this.payload = {}
  }

  flushPayload(cb) {
    const toFlush = JSON.stringify({
      metadata: this.metadata,
      data: this.payload
    })

    zlib.gzip(toFlush, function flushCompressed(err, compressed) {
      if (err) {
        logger.warn('Encountered an error while attempting to compress payload', err)
        return cb(err)
      }

      /* eslint-disable no-console */
      console.log([1, 'NR_LAMBDA_MONITORING', compressed.toString('base64')])
      /* eslint-enable no-console */

      cb()
    })
  }
}

module.exports = ServerlessCollector
