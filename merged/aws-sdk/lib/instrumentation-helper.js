'use strict'

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

module.exports = {
  instrumentationSupported
}
