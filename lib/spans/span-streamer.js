'use strict'

const logger = require('../logger').child({component: 'span-streamer'})
const GrpcConnection = require('../grpc/connection')

const NO_STREAM_WARNING =
  'Attempting to stream spans before connection created. ' +
  'This warning will not appear again this agent run.'

class SpanStreamer {
  constructor(endpoint, license_key, connection = new GrpcConnection()) {
    this.stream = null
    this.endpoint = endpoint
    this.license_key = license_key
    this.connection = connection
  }

  write(span) {
    if (!this.stream) {
      logger.warnOnce(NO_STREAM_WARNING)
      return
    }

    return this.stream.write(span)
  }

  connect(agent_run_id) {
    this.stream = this.connection.connectSpans(
      this.endpoint,
      this.license_key,
      agent_run_id
    )
  }

  disconnect() {
    // TODO: disconnect/cancel/verb connection here
  }
}

module.exports = SpanStreamer
