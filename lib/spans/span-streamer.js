'use strict'
const logger = require('../logger')
class SpanStreamer {
  constructor(endpoint, license_key, connection) {
    // this.opts = opts ? opts : {}
    this.stream = null
    this.endpoint = endpoint
    this.license_key = license_key
    this.connection = connection
  }
  write(span) {
    try {
      return this.stream.write(span)
    } catch (e) {
      logger.trace('Could not stream span %s', e.message)
    }
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
