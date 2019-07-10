'use strict'

module.exports = {
  isExpected: function isExpected(type, message, transaction, config, urltils) {
    let isExpectedTransactionCode = false
    if (transaction && urltils.isExpectedError(config, transaction.statusCode)) {
      isExpectedTransactionCode = true
    }
    return this.isExpectedErrorMessage(config, message) ||
      this.isExpectedErrorClass(config, type) ||
      isExpectedTransactionCode
  },
  isExpectedErrorMessage: function isExpectedError(config, message) {
    if (config.error_collector.expected_messages.length > 0) {
      if (-1 !== config.error_collector.expected_messages.indexOf(message)) {
        return true
      }
    }
    return false
  },
  isExpectedErrorClass: function isExpectedError(config, className) {
    if (config.error_collector.expected_classes.length > 0) {
      if (-1 !== config.error_collector.expected_classes.indexOf(className)) {
        return true
      }
    }
    return false
  },
  isExpectedException: function isExpectedException(transaction, exception, config, urltils) {
    let {type, message} = this.extractErrorInformation(transaction, exception, config, urltils)

    return this.isExpectedErrorClass(config, type) ||
      this.isExpectedErrorMessage(config, message)
  },

  extractErrorInformation: function extractErrorInformation(transaction, exception, config, urltils) {
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
  }
}
