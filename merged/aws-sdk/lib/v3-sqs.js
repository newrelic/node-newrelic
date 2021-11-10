/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { grabLastUrlSegment } = require('./util')

const SEND_COMMANDS = ['SendMessageCommand', 'SendMessageBatchCommand']

const RECEIVE_COMMANDS = ['ReceiveMessageCommand']

function wrapClientSend(shim, original, name, args) {
  const {
    constructor,
    input: { QueueUrl }
  } = args[0]
  const type = constructor.name
  if (SEND_COMMANDS.includes(type)) {
    return {
      callback: shim.LAST,
      destinationName: grabLastUrlSegment(QueueUrl),
      destinationType: shim.QUEUE,
      opaque: true
    }
  }

  // eslint-disable-next-line consistent-return
  return
}

function wrapClientReceive(shim, original, name, args) {
  const {
    constructor,
    input: { QueueUrl }
  } = args[0]
  const type = constructor.name
  if (RECEIVE_COMMANDS.includes(type)) {
    return {
      callback: shim.LAST,
      destinationName: grabLastUrlSegment(QueueUrl),
      destinationType: shim.QUEUE,
      opaque: true
    }
  }

  // eslint-disable-next-line consistent-return
  return
}

module.exports = function instrument(shim, AWS) {
  if (!shim.isFunction(AWS.SQS)) {
    shim.logger.debug('Could not find SQS, not instrumenting.')
    return
  }

  shim.setLibrary(shim.SQS)
  shim.recordProduce(AWS.SQSClient.prototype, 'send', wrapClientSend)
  shim.recordConsume(AWS.SQSClient.prototype, 'send', wrapClientReceive)
}
