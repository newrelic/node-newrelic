'use strict'

var logger = require('../logger').child({component: 'distributedTracePayload'})
var makeBuffer = require('../util/hashes').makeBuffer

const DT_VERSION_MAJOR = 0
const DT_VERSION_MINOR = 1

module.exports = class DistributedTracePayload {
  constructor(payload) {
    logger.trace('DistributedTracePayload created with %s', payload)
    this.plainTextPayload = JSON.stringify({
      v: [DT_VERSION_MAJOR, DT_VERSION_MINOR],
      d: payload
    })
    this.base64Payload = null
  }

  text() {
    logger.trace('DistributedTracePayload text: %s', this.plainTextPayload)
    return this.plainTextPayload
  }

  httpSafe() {
    if (!this.base64Payload) {
      this.base64Payload = makeBuffer(this.plainTextPayload, 'utf-8').toString('base64')
    }
    logger.trace('DistributedTracePayload httpSafe: %s', this.base64Payload)
    return this.base64Payload
  }
}

module.exports.Stub = class DistributedTracePayloadStub {
  text() {
    logger.debug('DistributedTracePayloadStub text')
    return ''
  }

  httpSafe() {
    logger.debug('DistributedTracePayloadStub httpSafe')
    return ''
  }
}
