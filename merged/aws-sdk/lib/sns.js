'use strict'

module.exports = {
  name: 'sns',
  type: 'message',
  validate: (shim, AWS) => {
    if (!shim.isFunction(AWS.DynamoDB)) {
      shim.logger.debug('Could not find DynamoDB, not instrumenting.')
      return false
    }
    return true
  },
  instrument
}

function instrument(shim, AWS) {
  shim.setLibrary(shim.SNS || 'SNS') // TODO: add to message-shim in agent

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

function getDestinationName({TopicArn, TargetArn}) {
  // ignoring PhoneNumber
  return TopicArn || TargetArn || 'Unknown'
}
