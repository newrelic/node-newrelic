'use strict'
var logger = require('../logger').child({component: 'distributedTracePayload'})
var makeBuffer = require('../util/hashes').makeBuffer

module.exports = class DistributedTracePayload {
  constructor(payload) {
    logger.trace('DistributedTracePayload created with %s', payload)
    this.plainTextPayload = JSON.stringify({v: [0,1], d: payload})
    this.base64Payload = makeBuffer(this.plainTextPayload, 'utf-8').toString('base64')
  }

  text() {
    logger.trace('DistributedTracePayload text: %s', this.plainTextPayload)
    return this.plainTextPayload
  }

  httpSafe() {
    logger.trace('DistributedTracePayload httpSafe: %s', this.base64Payload)
    return this.base64Payload
  }
}

module.exports.stub = class DistributedTracePayloadStub {
  text() {
    logger.debug('DistributedTracePayloadStub text')
    return ''
  }

  httpSafe() {
    logger.debug('DistributedTracePayloadStub httpSafe')
    return ''
  }
}
