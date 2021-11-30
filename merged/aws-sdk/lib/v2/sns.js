/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  name: 'sns',
  type: 'message',
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.SNS)) {
      shim.logger.debug('Could not find SNS, not instrumenting.')
      return false
    }
    return true
  },
  instrument
}

function instrument(shim, AWS) {
  shim.setLibrary(shim.SNS)

  shim.wrapReturn(AWS, 'SNS', function wrapSns(shim, original, name, sns) {
    shim.recordProduce(sns, 'publish', wrapPublish)
  })
}

function wrapPublish(shim, original, name, args) {
  return {
    callback: shim.LAST,
    destinationName: getDestinationName(args[0]),
    destinationType: shim.TOPIC,
    opaque: true
  }
}

function getDestinationName({ TopicArn, TargetArn }) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}
