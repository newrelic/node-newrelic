'use strict'

var stringifySafe = require('json-stringify-safe')

module.exports = function stringify(obj, callback) {
  try {
    return stringifySafe(obj)
  } catch (err) {
    if (typeof callback === 'function') {
      return callback(err)
    }
    return '[UNPARSABLE OBJECT]'
  }
}
