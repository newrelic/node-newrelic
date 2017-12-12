'use strict'

var stringifySafe = require('json-stringify-safe')

module.exports = {
  parse: function parseAsync(str, cb) {
    try {
      cb(null, JSON.parse(str))
    } catch (err) {
      cb(err, null)
    }
  }
}
