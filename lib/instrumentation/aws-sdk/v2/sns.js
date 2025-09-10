/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { MessageSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

module.exports = {
  name: 'sns',
  type: InstrumentationDescriptor.TYPE_MESSAGE,
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.SNS)) {
      shim.logger.debug('Could not find SNS, not instrumenting.')
      return false
    }
    return true
  },
  instrument
}

/**
 *
 * @param shim
 * @param AWS
 */
function instrument(shim, AWS) {
  shim.setLibrary(shim.SNS)

  shim.wrapReturn(AWS, 'SNS', function wrapSns(shim, original, name, sns) {
    shim.recordProduce(sns, 'publish', wrapPublish)
  })
}

/**
 *
 * @param shim
 * @param original
 * @param name
 * @param args
 */
function wrapPublish(shim, original, name, args) {
  return new MessageSpec({
    callback: shim.LAST,
    destinationName: getDestinationName(args[0]),
    destinationType: shim.TOPIC,
    opaque: true
  })
}

/**
 *
 * @param root0
 * @param root0.TopicArn
 * @param root0.TargetArn
 */
function getDestinationName({ TopicArn, TargetArn }) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}
