'use strict'

module.exports = {
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
    // unavoidably(?) duplicates logic found in createError
    var name = 'Unknown'
    var message = ''
    var type = 'Error'

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
    return this.isExpectedErrorClass(config, type) ||
      this.isExpectedErrorMessage(config, type)
  }

}
