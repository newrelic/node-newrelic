/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('../util')
const { MessageSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

module.exports = {
  name: 'sqs',
  type: InstrumentationDescriptor.TYPE_MESSAGE,
  validate,
  instrument
}

/**
 *
 * @param shim
 * @param AWS
 */
function validate(shim, AWS) {
  if (!shim.isFunction(AWS.SQS)) {
    shim.logger.debug('Could not find AWS.SQS')

    return false
  }

  return true
}

/**
 *
 * @param shim
 * @param AWS
 */
function instrument(shim, AWS) {
  // This needs to happen before any instrumentation
  shim.setLibrary(shim.SQS)

  shim.wrapReturn(AWS, 'SQS', function wrapSqs(shim, original, name, sqs) {
    shim.recordProduce(sqs, 'sendMessage', recordMessageApi)
    shim.recordProduce(sqs, 'sendMessageBatch', recordMessageApi)
    shim.recordConsume(sqs, 'receiveMessage', recordMessageApi)
  })
}

/**
 *
 * @param shim
 * @param original
 * @param name
 * @param args
 */
function recordMessageApi(shim, original, name, args) {
  const params = args[0]
  const queueName = grabLastUrlSegment(params.QueueUrl)

  return new MessageSpec({
    callback: shim.LAST,
    destinationName: queueName,
    destinationType: shim.QUEUE,
    opaque: true
  })
}
