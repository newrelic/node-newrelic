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
  permanent_disconnect:3,
  0:'disconnected',
  1:'connecting',
  2:'connected',
  3:'permanent_disconnect'
}

const protoOptions = {keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const pathProtoDefinition = __dirname +
  '../../../lib/grpc/endpoints/infinite-tracing/v1.proto'

/**
 * Class for managing the GRPC connection
 *
 * Both @grpc/grpc-js and grpc will manage the http2 connections
 * for us -- this class manages the _stream_ connection logic.
 *
 * Will emit events based on the connectionStates (see above
 */
class GrpcConnection extends EventEmitter {
  /**
   * GrpcConnection constructor
   *
   * Standard property setting/initilization, and sets an initial
   * connection state of disconnected
   *
   * @param {MetricAggregator} metrics metric aggregator, for supportability metrics
   * @param {Array} backoffs array of backoff values, in seconds
   * @param {int} tries number of tries, here so we can inject values
   */
  constructor(metrics, backoffs = [0, 15], tries = 0) {
    super()
    this._backoffs = backoffs
    this._tries = tries
    this._metrics = metrics
    this._setState(connectionStates.disconnected)

    this._endpoint = null
    this._licensekey = null
    this._runId = null
  }

  /**
   * Sets connection details
   *
   * Allows setting of connection details _after_ object constructions
   * but before the actual connection.
   *
   * @param {string} endpoint the GRPC server's endpoint, see also _formatTraceObserverUrl
   * @param {string} license_key the agent license key
   * @param {string} run_id the current agent run id (also called agent run token)
   */
  setConnectionDetails(endpoint, license_key, run_id) {
    this._endpoint = endpoint
    this._licenseKey = license_key
    this._runId = run_id
    return this
  }

  /**
   * Sets the connection state
   *
   * Used to indicate a transition from one connection state to
   * the next.  Also responsible for emitting the connect state event
   *
   * @param {int} state The connection state (See connectionStates above)
   * @param {ClientDuplexStreamImpl} state The GRPC stream, when defined
   */
  _setState(state, stream = null) {
    // no more state setting after permanatly disconnected
    if (this._state === connectionStates.permanent_disconnect) {
      return
    }
    this._state = state
    this.emit(connectionStates[state], stream)
  }

  /**
   * Start the Connection
   *
   * Public Entry point -- initiates a connection
   */
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

  /**
   * Resets tries to 0, as though this was the first attempt
   */
  _resetTries() {
    this._tries = 0
  }

  /**
   * Increments tries
   */
  _incrementTries() {
    this._tries++
  }

  /**
   * Calculates backoff seconds
   */
  _getBackoffSeconds() {
    if (this._tries >= this._backoffs.length) {
      return this._backoffs[this._backoffs.length - 1]
    }
    return this._backoffs[this._tries]
  }

  /**
   * Formats a URL the way our grpc library wants it
   *
   * Removes protocol, ensures explicit port.  This is
   * here to ensure the URL as configured conforms to
   * what the GRPC libraries want, as well as ensure
   * the weird behavior of URL around removing the
   * port dependeing on protocol is worked around
   *
   * @param {string} endpoint
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

  /**
   * Method returns GRPC metadata for initial connection
   *
   * @param {string} license_key
   * @param {string} run_id
   */
  _getMetadata(license_key, run_id, env) {
    const metadata = new grpc.Metadata()
    metadata.add('license_key', license_key)
    metadata.add('agent_run_token', run_id)

    const flaky = parseInt(env.NEWRELIC_GRPCCONNECTION_METADATA_FLAKY, 10)
    const delay = parseInt(env.NEWRELIC_GRPCCONNECTION_METADATA_DELAY, 10)
    if (flaky) {
      metadata.add('flaky', flaky)
    }
    if (delay) {
      metadata.add('delay',delay)
    }

    return metadata
  }

  /**
   * Disconnects
   *
   * Called when we receive a stream status that indicates a potential
   * problem with the stream.  We set the state (which will emit an event),
   * increment tries to honor the backoff, and then reconnect
   */
  _disconnect() {
    this._setState(connectionStates.disconnected)
    this._incrementTries()
    this.connectSpans()
  }

  /**
   * Disconnects Without Reconnect
   *
   * Certain GRPC statuses require us to disconnect and _not_
   * attempt a stream reconnect.
   */
  _disconnectWithoutReconnect() {
    // set both states to issue both events
    this._setState(connectionStates.disconnected)
    this._setState(connectionStates.permanent_disconnect)
  }

  /**
   * Central location to setup stream observers
   *
   * Events from the GRPC stream (a ClientDuplexStreamImpl) are the main way
   * we communicate with the GRPC server.
   *
   * @param {ClientDuplexStreamImpl} stream
   */
  _setupSpanStreamObservers(stream) {
    // listen for responses from server and log
    if (logger.traceEnabled()) {
      stream.on('data', function data(response) {
        logger.trace("grpc span response stream: %s", JSON.stringify(response))
      })
    }

    // listen for status that indicate stream has ended,
    // and we need todisconnect
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

  /**
   * Creates the GRPC credentials needed
   */
  _generateCredentials(grpcApi) {
    return grpcApi.credentials.createSsl()
  }

  /**
   * Internal/private method for connection
   *
   * Contains the actual logic that connects to the GRPC service.
   * "Connection" can be a somewhat misleading term here.  This method
   * invokes the "recordSpan" remote proceduce call. Behind the scenes
   * this makes an http2 request with the metadata, and then returns
   * a stream for further writing.
   */
  _connectSpans(url, license_key, run_id) {
    const packageDefinition = protoLoader.loadSync(pathProtoDefinition, protoOptions)

    const serviceDefinition = grpc.loadPackageDefinition(
      packageDefinition
    ).com.newrelic.trace.v1

    const endpoint = this._formatTraceObserverUrl(url)
    const credentials = this._generateCredentials(grpc)

    // console.log(credentials)
    const client = new serviceDefinition.IngestService(
      endpoint,
      credentials
    )
    const metadata = this._getMetadata(license_key, run_id, process.env)
    const stream = client.recordSpan(metadata)
    this._setupSpanStreamObservers(stream)

    return stream
  }
}
module.exports = GrpcConnection
