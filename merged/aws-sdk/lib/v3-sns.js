/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function wrapClientSend(shim, original, name, args) {
  const { constructor, input } = args[0]
  const type = constructor.name
  if (type === 'PublishCommand') {
    return {
      callback: shim.LAST,
      destinationName: getDestinationName(input),
      destinationType: shim.TOPIC,
      opaque: true
    }
  }

  // eslint-disable-next-line consistent-return
  return
}

function getDestinationName({ TopicArn, TargetArn }) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}

module.exports = function instrument(shim, AWS) {
  if (!shim.isFunction(AWS.SNS)) {
    shim.logger.debug('Could not find SNS, not instrumenting.')
    return
  }

  shim.setLibrary(shim.SNS)
  shim.recordProduce(AWS.SNSClient.prototype, 'send', wrapClientSend)
}
