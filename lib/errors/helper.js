'use strict'

module.exports = {
  isExpected: function isExpected(type, message, transaction, config, urltils) {
    let isExpectedTransactionCode = false
    if (transaction && urltils.isExpectedError(config, transaction.statusCode)) {
      isExpectedTransactionCode = true
    }
    return this.isExpectedErrorMessage(config, type, message) ||
      this.isExpectedErrorClass(config, type) ||
      isExpectedTransactionCode
  },
  isExpectedErrorMessage: function isExpectedErrorMessage(config, type, message) {
    if (!config.error_collector.expected_messages[type]) {
      return false
    }
    if (config.error_collector.expected_messages[type].length > 0) {
      if (-1 !== config.error_collector.expected_messages[type].indexOf(message)) {
        return true
      }
    }
    return false
  },
  isExpectedErrorClass: function isExpectedErrorClass(config, className) {
    if (config.error_collector.expected_classes.length > 0) {
      if (-1 !== config.error_collector.expected_classes.indexOf(className)) {
        return true
      }
    }
    return false
  },
  isExpectedException: function isExpectedException(
    transaction,
    exception,
    config,
    urltils
  ) {
    let {type, message} = this.extractErrorInformation(
      transaction,
      exception,
      config,
      urltils
    )

    return this.isExpectedErrorClass(config, type) ||
      this.isExpectedErrorMessage(config, type, message)
  },

  extractErrorInformation: function extractErrorInformation(
    transaction,
    exception,
    config,
    urltils
  ) {
    let name = 'Unknown'
    let message = ''
    let type = 'Error'

    // String errors do not provide us with as much information to provide to the
    // user, but it is a common pattern.
    if (typeof exception === 'string') {
      message = exception
    } else if (
      exception !== null &&
      typeof exception === 'object' &&
      exception.message &&
      !config.high_security &&
      !config.strip_exception_messages.enabled
    ) {
      message = exception.message

      if (exception.name) {
        type = exception.name
      } else if (exception.constructor && exception.constructor.name) {
        type = exception.constructor.name
      }
    } else if (transaction && transaction.statusCode &&
               urltils.isError(config, transaction.statusCode)) {
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
      name:name,
      message:message,
      type:type,
    }
  },

  shouldIgnoreError: function shouldIgnoreError(transaction, exception, config) {
    // extract _just_ the error information, not transaction stuff
    let errorInfo = this.extractErrorInformation(null, exception, config, null)

    return this.shouldIgnoreErrorClass(errorInfo, config) ||
      this.shouldIgnoreErrorMessage(errorInfo, config) ||
      this.shouldIgnoreStatusCode(transaction, config)
  },

  shouldIgnoreStatusCode: function shouldIgnoreStatusCode(transaction, config) {
    if (!transaction) {
      return false
    }
    return config.error_collector.ignore_status_codes.indexOf(
      transaction.statusCode
    ) !== -1
  },

  shouldIgnoreErrorClass: function shouldIgnoreErrorClass(errorInfo, config) {
    if (config.error_collector.ignore_classes.length < 1) {
      return false
    }

    return -1 !== config.error_collector.ignore_classes.indexOf(errorInfo.type)
  },

  shouldIgnoreErrorMessage: function shouldIgnoreErrorMessage(errorInfo, config) {
    let configIgnoreMessages = config.error_collector.ignore_messages[errorInfo.type]
    if (!configIgnoreMessages) {
      return false
    }

    if (configIgnoreMessages.length > 0) {
      if (-1 !== configIgnoreMessages.indexOf(errorInfo.message)) {
        return true
      }
    }
    return false
  }
}
