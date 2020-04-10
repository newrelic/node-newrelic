'use strict'

const protoLoader = require('@grpc/proto-loader')
const grpc = require('../proxy/grpc')
const logger = require('../logger').child({component: 'grpc_connection'})
const EventEmitter = require('events')
const NAMES = require('../metrics/names')
const util = require('util')
const URL = require('url').URL

const connectionStates = require('./connection/states')

const protoOptions = {keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const pathProtoDefinition = __dirname +
  '../../../lib/grpc/endpoints/infinite-tracing/v1.proto'

const defaultBackoffOpts = {
  initialSeconds: 0,
  seconds:15
}

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
   * @param {Object} backoffOpts allows injecting specific backoff times
   */
  constructor(metrics, backoffOpts = defaultBackoffOpts) {
    super()

    // only set opts if the object is valid
    if ( (backoffOpts.initialSeconds || backoffOpts.initialSeconds === 0) &&
         (backoffOpts.seconds || backoffOpts.seconds === 0)) {
      this._backoffOpts = backoffOpts
    } else {
      this._backoffOpts = defaultBackoffOpts
      logger.trace(
        'invalid backoff information passed to constructor, using default values'
      )
    }

    // initial "stream connection" has a 0 second backoff, unless
    // different values are injected via _backoffOpts
    this._streamBackoffSeconds = this._backoffOpts.initialSeconds
    this._metrics = metrics
    this._setState(connectionStates.disconnected)

    this._endpoint = null
    this._licensekey = null
    this._runId = null

    this.stream = null
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
   * @param {string} [rootCerts] string of root (ca) certificates to attach to the connection.
   */
  setConnectionDetails(endpoint, license_key, run_id, rootCerts) {
    this._endpoint = endpoint
    this._licenseKey = license_key
    this._runId = run_id
    this._rootCerts = rootCerts

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
        this.stream = this._connectSpans(this._endpoint, this._licenseKey, this._runId)
        this._setState(connectionStates.connected, this.stream)
        // any future stream connect/disconnect after initial connection
        // should have a 15 second backoff
        this._setStreamBackoffAfterInitialStreamSetup()
      } catch (err) {
        logger.trace(
          err,
          'Unexpected error establishing GRPC stream, will not attempt reconnect.'
        )
        this._disconnectWithoutReconnect()
      }
    }, this._getBackoffSeconds() * 1000)
  }

  _setStreamBackoffAfterInitialStreamSetup() {
    this._streamBackoffSeconds = this._backoffOpts.seconds
  }

  _setStreamBackoffToInitialValue() {
    this._streamBackoffSeconds = this._backoffOpts.initialSeconds
  }

  /**
   * End the current stream and set state to disconnected.
   *
   * No more data can be sent until connected again.
   */
  disconnect() {
    if (this._state === connectionStates.disconnected) {
      return
    }

    this._disconnectWithoutReconnect()
  }

  /**
   * Calculates backoff seconds
   */
  _getBackoffSeconds() {
    return this._streamBackoffSeconds
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

    // check environment variables for testing parameters and
    // pass to server via meta-data.
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
   * Sets internal object state to disconnected initiates a new connection
   *
   * Called when we receive a stream status that indicates a potential
   * problem with the stream.  We set the state (which will emit an event),
   * increment tries to honor the backoff, and then reconnect.
   */
  _reconnect() {
    this._setState(connectionStates.disconnected)
    this.connectSpans()
  }

  /**
   * Disconnects Without Reconnect
   *
   * Certain GRPC statuses require us to disconnect and _not_
   * attempt a stream reconnect.
   */
  _disconnectWithoutReconnect() {
    if (this.stream) {
      this.stream.removeAllListeners()

      // Indicates to server we are done.
      // Server officially closes the stream.
      this.stream.end()
      this.stream = null
    }

    this._setState(connectionStates.disconnected)
    this._setStreamBackoffToInitialValue()
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
    // and we need to disconnect
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
      // indicates the call completed successfully, which indicates
      // the stream is over.
      if (grpc.status[grpc.status.UNIMPLEMENTED] === grpcStatusName) {
        // per the spec, An UNIMPLEMENTED status code from gRPC indicates
        // that the versioned Trace Observer is no longer available. Agents
        // MUST NOT attempt to reconnect in this case
        this._disconnectWithoutReconnect()
      } else {
        this._reconnect()
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
    let certBuffer = null

    // Current settable value for testing. If allowed to be overriden via
    // configuration, this should be removed in place of setting
    // this._rootCerts from config via normal configuration precedence.
    const envTestCerts = process.env.NEWRELIC_GRPCCONNECTION_CA
    const rootCerts = this._rootCerts || envTestCerts
    if (rootCerts) {
      logger.debug('Infinite tracing root certificates found to attach to requests.')
      try {
        certBuffer = Buffer.from(rootCerts, 'utf-8')
      } catch (err) {
        logger.warn('Failed to create buffer from rootCerts, proceeding without.', err)
      }
    }

    // null/undefined ca treated same as calling createSsl()
    return grpcApi.credentials.createSsl(certBuffer)
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
