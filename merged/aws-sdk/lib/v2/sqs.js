/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('../util')
module.exports = {
  name: 'sqs',
  type: 'message',
  validate,
  instrument
}

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.SQS)) {
    shim.logger.debug('Could not find AWS.SQS')

    return false
  }

  return true
}

function instrument(shim, AWS) {
  // This needs to happen before any instrumentation
  shim.setLibrary(shim.SQS)

  shim.wrapReturn(AWS, 'SQS', function wrapSqs(shim, original, name, sqs) {
    shim.recordProduce(sqs, 'sendMessage', recordMessageApi)
    shim.recordProduce(sqs, 'sendMessageBatch', recordMessageApi)
    shim.recordConsume(sqs, 'receiveMessage', recordMessageApi)
  })
}

function recordMessageApi(shim, original, name, args) {
  const params = args[0]
  const queueName = grabLastUrlSegment(params.QueueUrl)

  return {
    callback: shim.LAST,
    destinationName: queueName,
    destinationType: shim.QUEUE,
    opaque: true
  }
}
