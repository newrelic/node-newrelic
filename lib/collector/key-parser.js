'use strict'

module.exports.parseKey = function parseKey(licenseKey) {
  var regionMatch = /^(.+?)x/.exec(licenseKey)
  return regionMatch && regionMatch[1]
}
