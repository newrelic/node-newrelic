'use strict'

const protoLoader = require('@grpc/proto-loader')
const grpc = require('../proxy/grpc')
const logger = require('../logger').child({component: 'grpc_connection'})

const connectionStates = {
  disconnected:0,
  connecting:1,
  disconnected:2,
  connected:3
}

const protoOptions = {keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const pathProtoDefinition = __dirname +
  '../../../lib/grpc/endpoints/infinite-tracing/v1.proto'

class GrpcConnection {
  constructor(backoffs = [0, 15, 15, 30, 60, 120, 300], tries = 0) {
    this._backoffs = backoffs
    this._tries = tries
    this._state = connectionStates.disconnected
  }

  connectSpans(endpoint, license_key, run_id, callback) {
    if (this._state !== connectionStates.disconnected) {
      console.log(this._state)
      // either already connected or connecting
      return
    }

    this._state = connectionStates.connecting
    console.log(
      "connecting to grpc endpoint in [%s] seconds",
      this._getBackoffSeconds()
    )
    setTimeout(() => {
      try {
        this._state = connectionStates.connected
        const stream = this._connectSpans(endpoint, license_key, run_id)
        callback(null, stream)
      } catch (err) {
        console.log(err)
        this._incrementTries()
        callback(err)
      }
    }, this._getBackoffSeconds())
  }

  _resetTries() {
    this._tries = 0
  }

  _incrementTries() {
    this._tries++
  }

  _getBackoffSeconds() {
    if(this._tries >= this._backoffs.length) {
      return this._backoffs[this._backoffs.length-1]
    }
    return this._backoffs[this._tries]
  }

  _getProtobuffDefinition(protoLoader, pathProtoDefinition, protoOptions) {
    return protoLoader.loadSync(pathProtoDefinition, protoOptions)
  }

  _getServiceDefinition(grpc, packageDefinition, packageName) {
    let service = grpc.loadPackageDefinition(packageDefinition)
    for (const [,key] of packageName.split('.').entries()) {
      service = service[key]
    }
    return service
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

  _getMetadata(grpc, license_key, run_id) {
    const metadata = new grpc.Metadata()

    metadata.add('license_key', license_key)
    metadata.add('agent_run_token', run_id)
    metadata.add('flaky', '100')
    return metadata
  }

  _setupSpanStreamObservers(stream) {

    // listen for responses from server and log
    if (logger.traceEnabled()) {
      stream.on('data', function data(response) {
        logger.trace("grpc span response stream: %s", JSON.stringify(response))
      })
    }

    // listen for status that indicate stream has ended and attempt reconnect
    stream.on('status', function status(status) {
      if (grpc.status.OK !== status.code) {
        throw new Error(`right now I think we need to initiate a reconnection
whenever we get a non OK status code -- although maybe even for OK status codes
since that means the stream has ended fine, but its still ended?  Also, how do
we _know_ when we're connected and should reset the tries to zero?`)
      }
    })

    // if we don't listen for the errors they'll crash us
    stream.on('error', function status(err) {
      logger.trace('span stream error. Code: [%s]: %s',err.code, err.details)
    })
  }

  _connectSpans(url, license_key, run_id) {
    const packageDefinition = this._getProtobuffDefinition(
      protoLoader,
      pathProtoDefinition,
      protoOptions
    )

    const serviceDefinition = this._getServiceDefinition(
      grpc,
      packageDefinition,
      'com.newrelic.trace.v1'
    )
    const endpoint = this._formatTraceObserverUrl(url)
    const client = new serviceDefinition.IngestService(
      endpoint,
      grpc.credentials.createSsl()
    )
    const metadata = this._getMetadata(grpc, license_key, run_id)
    const stream = client.recordSpan(metadata)
    this._setupSpanStreamObservers(stream)

    return stream
  }
}
module.exports = GrpcConnection
