'use strict'

/**
 * Encapsulates all the possible actions to take in response to the collector.
 */
class CollectorResponse {
  constructor(retainData, retryAfter, shutdownAgent, payload) {
    this.retainData = retainData
    this.retryAfter = retryAfter
    this.shutdownAgent = shutdownAgent
    this.payload = payload
  }

  static success(payload) {
    return new CollectorResponse(false, 0, false, payload)
  }

  static discard(payload) {
    return this.success(payload)
  }

  static error(payload) {
    return new CollectorResponse(true, 0, false, payload)
  }

  static fatal(payload) {
    return new CollectorResponse(false, 0, true, payload)
  }

  static retry(delayMS, payload) {
    return new CollectorResponse(true, delayMS, false, payload)
  }

  static reconnect(delayMS, payload) {
    return new CollectorResponse(false, delayMS, true, payload)
  }
}

module.exports = CollectorResponse
