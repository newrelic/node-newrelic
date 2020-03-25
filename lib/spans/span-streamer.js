'use strict'
const GrpcConnection = require('../grpc/connection')

class SpanStreamer {
  constructor(endpoint, license_key, connection = new GrpcConnection()) {
    this.stream = null
    this.endpoint = endpoint
    this.license_key = license_key
    this.connection = connection
  }
  write(span) {
    return this.stream.write(span)
  }

  connect(agent_run_id) {
    this.connection.connectSpans(
      this.endpoint,
      this.license_key,
      agent_run_id,
      (err, stream) => {
        // if our connection was an error, try to reconnect
        // (won't this go on forever?
        if (err) {
          return this.connect(agent_run_id)
        }

        // if a success, set the stream
        this.stream = stream
      }
    )
  }

  disconnect() {
    // TODO: disconnect/cancel/verb connection here
  }
}

module.exports = SpanStreamer
