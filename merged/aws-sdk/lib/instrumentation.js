'use strict'

const INSTRUMENTATIONS = [
  require('./core'),
  require('./dynamodb'),
  require('./sqs'),
  require('./sns')
]

/**
 * Series of tests to determine if the library
 * has the features needed to provide instrumentation
 */
const instrumentationSupported = function instrumentationSupported(AWS) {
  // instrumentation requires the serviceClientOperationsMap property
  if (!AWS ||
      !AWS.DynamoDB ||
      !AWS.DynamoDB.DocumentClient ||
      !AWS.DynamoDB.DocumentClient.prototype ||
      !AWS.DynamoDB.DocumentClient.prototype.serviceClientOperationsMap) {
    return false
  }

  return true
}

module.exports = function initialize(shim, AWS) {
  if(!instrumentationSupported(AWS)) {
    return false
  }
  // Validate every instrumentation before attempting to run any of them.
  for (let instrumentation of INSTRUMENTATIONS) {
    if (!instrumentation.validate(shim, AWS)) {
      return false
    }
  }

  for (let instrumentation of INSTRUMENTATIONS) {
    const subshim = shim.makeSpecializedShim(instrumentation.type, instrumentation.name)
    instrumentation.instrument(subshim, AWS)
  }

  return true
}
