/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  isExpected: function isExpected(type, message, transaction, config, urltils) {
    let isExpectedTransactionCode = false
    if (transaction && urltils.isExpectedError(config, transaction.statusCode)) {
      isExpectedTransactionCode = true
    }
    return (
      this.isExpectedErrorMessage(config, type, message) ||
      this.isExpectedErrorClass(config, type) ||
      isExpectedTransactionCode
    )
  },
  isExpectedErrorMessage: function isExpectedErrorMessage(config, type, message) {
    if (!config.error_collector.expected_messages[type]) {
      return false
    }

    return (
      config.error_collector.expected_messages[type].length > 0 &&
      config.error_collector.expected_messages[type].indexOf(message) !== -1
    )
  },
  isExpectedErrorClass: function isExpectedErrorClass(config, className) {
    return (
      config.error_collector.expected_classes.length > 0 &&
      config.error_collector.expected_classes.indexOf(className) !== -1
    )
  },
  isExpectedException: function isExpectedException(transaction, exception, config, urltils) {
    // this is getting JUST the exception.error
    const { type, message } = this.extractErrorInformation(
      transaction,
      exception.error,
      config,
      urltils
    )

    return (
      exception._expected ||
      this.isExpectedErrorClass(config, type) ||
      this.isExpectedErrorMessage(config, type, message)
    )
  },

  extractErrorInformation: function extractErrorInformation(transaction, error, config, urltils) {
    let name = 'Unknown'
    let message = ''
    let type = 'Error'

    // String errors do not provide us with as much information to provide to the
    // user, but it is a common pattern.
    if (typeof error === 'string') {
      message = error
    } else if (
      error !== null &&
      typeof error === 'object' &&
      error.message &&
      !config.high_security &&
      !config.strip_exception_messages.enabled
    ) {
      message = error.message

      if (error.name) {
        type = error.name
      } else if (error.constructor && error.constructor.name) {
        type = error.constructor.name
      }
    } else if (
      transaction &&
      transaction.statusCode &&
      urltils.isError(config, transaction.statusCode)
    ) {
      message = 'HttpError ' + transaction.statusCode
    }

    if (transaction) {
      // transaction.getName is expensive due to running normalizers and ignore
      // rules if a name hasn't been assigned yet.
      const txName = transaction.getFullName()
      if (txName) {
        name = txName
      }
    }

    return {
      name: name,
      message: message,
      type: type
    }
  },

  shouldIgnoreError: function shouldIgnoreError(transaction, error, config) {
    // extract _just_ the error information, not transaction stuff
    const errorInfo = this.extractErrorInformation(null, error, config, null)

    return (
      this.shouldIgnoreErrorClass(errorInfo, config) ||
      this.shouldIgnoreErrorMessage(errorInfo, config) ||
      this.shouldIgnoreStatusCode(transaction, config)
    )
  },

  shouldIgnoreStatusCode: function shouldIgnoreStatusCode(transaction, config) {
    if (!transaction) {
      return false
    }
    return config.error_collector.ignore_status_codes.indexOf(transaction.statusCode) !== -1
  },

  shouldIgnoreErrorClass: function shouldIgnoreErrorClass(errorInfo, config) {
    if (config.error_collector.ignore_classes.length < 1) {
      return false
    }

    return -1 !== config.error_collector.ignore_classes.indexOf(errorInfo.type)
  },

  shouldIgnoreErrorMessage: function shouldIgnoreErrorMessage(errorInfo, config) {
    const configIgnoreMessages = config.error_collector.ignore_messages[errorInfo.type]
    if (!configIgnoreMessages) {
      return false
    }

    return configIgnoreMessages.length > 0 && configIgnoreMessages.indexOf(errorInfo.message) !== -1
  }
}
