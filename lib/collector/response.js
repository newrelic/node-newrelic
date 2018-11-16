'use strict'

/**
 * Encapsulates all the possible actions to take in response to the collector.
 */
class CollectorResponse {
  constructor(retainData, retryAfter, shutdownAgent, returned) {
    this.retainData = retainData
    this.retryAfter = retryAfter
    this.shutdownAgent = shutdownAgent
    this.returned = returned
  }

  static success(returned) {
    return new CollectorResponse(false, 0, false, returned)
  }

  static error(returned) {
    return new CollectorResponse(true, 0, false, returned)
  }

  static fatal(returned) {
    return new CollectorResponse(false, 0, true, returned)
  }

  static retry(delayMS, returned) {
    return new CollectorResponse(true, delayMS, false, returned)
  }

  static reconnect(delayMS, returned) {
    return new CollectorResponse(false, delayMS, true, returned)
  }
}

module.exports = CollectorResponse
