'use strict'

const logger = require('../logger').child({component: 'span-streamer'})
const GrpcConnection = require('../grpc/connection')

class SpanStreamer {
  constructor(endpoint, license_key, connection = new GrpcConnection()) {
    this.stream = null
    this.endpoint = endpoint
    this.license_key = license_key
    this.connection = connection
  }

  write(span) {
    if (!this.stream) {
      logger.warnOnce(
        'Attempting to stream spans before connection created. ' +
        'This warning will not appear again this agent run.'
      )
      return
    }

    return this.stream.write(span)
  }

  connect(agent_run_id) {
    this.connection.setConnectionDetails(
      this.endpoint,
      this.license_key,
      agent_run_id
    )

    this.connection.on('connected', (stream) =>{
      this.stream = stream
    })

    this.connection.on('disconnected', () =>{
      this.stream = null
    })

    this.connection.connectSpans()
  }

  disconnect() {
    // TODO: disconnect/cancel/verb connection here
  }
}

module.exports = SpanStreamer
