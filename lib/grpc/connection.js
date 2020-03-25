'use strict'

const protoLoader = require('@grpc/proto-loader')
const grpc = require('../proxy/grpc')
const logger = require('../logger')

class GrpcConnection {
  constructor(backoffs = [0, 15, 15, 30, 60, 120, 300], tries = 0) {
    this._backoffs = backoffs
    this._tries = tries
    this._state = 'disconnected'
  }

  connectSpans(endpoint, license_key, run_id, callback) {
    if (this._state !== 'disconnected') {
      console.log(this._state)
      // either already connected or connecting
      return
    }

    this._state = 'connecting'
    setTimeout(() => {
      try {
        this._state = 'connected'
        const stream = this._connectSpans(endpoint, license_key, run_id, callback)
        callback(null, stream)
      } catch (err) {
        console.log(err)
        this._incrementTries()
        callback(err)
      }
    }, this._getBackoffSeconds())
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

  _connectSpans(endpoint, license_key, run_id, callback) {
    this.connectSpans(endpoint, license_key, run_id, callback)
    const packageDefinition = protoLoader.loadSync(
      __dirname + '../../../lib/grpc/endpoints/infinite-tracing/v1.proto',
      {keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      })

    const mtb = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1
    const client = new mtb.IngestService(
      endpoint,
      grpc.credentials.createSsl()
    )
    const metadata = new grpc.Metadata()

    metadata.add('license_key', license_key)
    metadata.add('agent_run_token', run_id)
    metadata.add('flaky', 99)
    const stream = client.recordSpan(metadata)

    if (logger.traceEnabled()) {
      stream.on('data', function data(response) {
        logger.trace("grpc span response stream: %s", JSON.stringify(response))
      })
    }

    var oldEmit = stream.emit;
    stream.emit = function newEmit() {
      console.log(arguments)
      oldEmit.apply(stream, arguments);
    }

    return stream
  }
}
module.exports = GrpcConnection
