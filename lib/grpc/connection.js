'use strict'

const protoLoader = require('@grpc/proto-loader')
const grpc = require('../proxy/grpc')
const logger = require('../logger').child({component: 'grpc_connection'})
const EventEmitter = require('events')
const NAMES = require('../metrics/names')
const util = require('util')

const connectionStates = {
  disconnected:0,
  connecting:1,
  connected:2,
  0:'disconnected',
  1:'connecting',
  2:'connected',
}

const protoOptions = {keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const pathProtoDefinition = __dirname +
  '../../../lib/grpc/endpoints/infinite-tracing/v1.proto'

class GrpcConnection extends EventEmitter {
  constructor(metrics, backoffs = [0, 15, 15, 30, 60, 120, 300], tries = 0) {
    super()
    this._backoffs = backoffs
    this._tries = tries
    this._metrics = metrics
    this._setState(connectionStates.disconnected)

    this._endpoint = null
    this._licensekey = null
    this._runId = null
  }

  setConnectionDetails(endpoint, license_key, run_id) {
    this._endpoint = endpoint
    this._licenseKey = license_key
    this._runId = run_id
  }

  _setState(state, stream) {
    this._state = state
    this.emit(connectionStates[state], stream)
  }

  connectSpans() {
    if (this._state !== connectionStates.disconnected) {
      return
    }

    this._setState(connectionStates.connecting)
    logger.trace('connecting to grpc endpoint in [%s] seconds', this._getBackoffSeconds())

    setTimeout(() => {
      try {
        const stream = this._connectSpans(this._endpoint, this._licenseKey, this._runId)
        this._setState(connectionStates.connected, stream)
      } catch (err) {
        this._incrementTries()
        logger.trace('GRPC Connection Error: %s', err.message)
        logger.trace(
          'Reconnecting in [%s] seconds, try number [%s]',
          this._getBackoffSeconds(),
          this._tries
        )

        // try connecting again in _backoff_ seconds
        setTimeout(
          this.connectSpans,
          this._getBackoffSeconds() * 1000
        )
      }
    }, this._getBackoffSeconds() * 1000)
  }

  _resetTries() {
    this._tries = 0
  }

  _incrementTries() {
    this._tries++
  }

  _getBackoffSeconds() {
    if (this._tries >= this._backoffs.length) {
      return this._backoffs[this._backoffs.length - 1]
    }
    return this._backoffs[this._tries]
  }

  /**
   * Formats a URL the way our grpc library wants it
   *
   * Removes protocol, ensures explicit port
   */
  _formatTraceObserverUrl(endpoint) {
    const url = new URL(endpoint)
    let port = url.port
    if (!port && url.protocol === 'http:') {
      port = '80'
    }
    if (!port && url.protocol === 'https:') {
      port = '443'
    }
    const parts = []
    parts.push(url.hostname)
    parts.push(':')
    parts.push(port)
    if (url.pathname && url.pathname !== '/') {
      parts.push(url.pathname)
    }
    parts.push(url.search)
    return parts.join('')
  }

  _getMetadata(license_key, run_id) {
    const metadata = new grpc.Metadata()
    metadata.add('license_key', license_key)
    metadata.add('agent_run_token', run_id)
    metadata.add('flaky', '100')
    return metadata
  }

  _disconnect() {
    this._setState(connectionStates.disconnected)
    this._incrementTries()
    this.connectSpans()
  }

  _disconnectWithoutReconnect() {
    this._setState(connectionStates.disconnected)
  }

  _setupSpanStreamObservers(stream) {
    // listen for responses from server and log
    if (logger.traceEnabled()) {
      stream.on('data', function data(response) {
        logger.trace("grpc span response stream: %s", JSON.stringify(response))
      })
    }

    // listen for status that indicate stream has ended and disconnect
    stream.on('status', (grpcStatus) => {
      logger.trace('GRPC Status Received [%s]: %s', grpcStatus.code, grpcStatus.details)
      const grpcStatusName =
        grpc.status[grpcStatus.code] ? grpc.status[grpcStatus.code] : 'UNKNOWN'
      const metric = this._metrics.getOrCreateMetric(
        util.format(NAMES.INFINITE_TRACING.SPAN_RESPONSE_ERROR, grpcStatusName)
      )
      metric.incrementCallCount()

      // all statuses are treated as "bad stuff" happened, and
      // as a signal we need to reconnect.  Event an "OK status"
      // indicates the call completed succesfully, which indicates
      // the stream isover.
      if (grpc.status[grpc.status.UNIMPLEMENTED] === grpcStatusName) {
        // per the spec, An UNIMPLEMENTED status code from gRPC indicates
        // that the versioned Trace Observer is no longer available. Agents
        // MUST NOT attempt to reconnect in this case
        this._disconnectWithoutReconnect()
      } else {
        this._disconnect()
      }
    })

    // if we don't listen for the errors they'll bubble
    // up and crash the application
    stream.on('error', (err) => {
      logger.trace('span stream error. Code: [%s]: %s',err.code, err.details)
    })
  }

  _connectSpans(url, license_key, run_id) {
    const packageDefinition = protoLoader.loadSync(pathProtoDefinition, protoOptions)

    const serviceDefinition = grpc.loadPackageDefinition(
      packageDefinition
    ).com.newrelic.trace.v1

    const endpoint = this._formatTraceObserverUrl(url)
    const client = new serviceDefinition.IngestService(
      endpoint,
      grpc.credentials.createSsl()
    )
    const metadata = this._getMetadata(license_key, run_id)
    const stream = client.recordSpan(metadata)
    this._setupSpanStreamObservers(stream)

    return stream
  }
}
module.exports = GrpcConnection
