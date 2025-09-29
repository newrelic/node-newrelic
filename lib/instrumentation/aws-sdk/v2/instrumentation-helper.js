/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Series of tests to determine if the library
 * has the features needed to provide instrumentation.
 * @param {object} AWS AWS SDK object
 */
const instrumentationSupported = function instrumentationSupported(AWS) {
  // instrumentation requires the serviceClientOperationsMap property
  /* eslint-disable-next-line */
  if (
    !AWS ||
    !AWS.DynamoDB ||
    !AWS.DynamoDB.DocumentClient ||
    !AWS.DynamoDB.DocumentClient.prototype ||
    !AWS.DynamoDB.DocumentClient.prototype.serviceClientOperationsMap
  ) {
    return false
  }

  return true
}

module.exports = {
  instrumentationSupported
}
