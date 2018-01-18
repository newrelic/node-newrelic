'use strict'

module.exports = TraceAttributes

/**
 * @class
 * @private
 */
function TraceAttributes(opts) {
  opts = opts || {}
  this.limit = opts.limit || Infinity
  this.attributes = {}
  this.count = 0
}

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
 */
TraceAttributes.prototype.isValidLength = isValidLength
function isValidLength(str) {
  return Buffer.byteLength(str, 'utf8') < 256
}

/**
 * Adds the given attribute to the instance attributes object,
 * overwriting existing keys if necessary.
 *
 * @param {array} destinations - Allowed destinations
 * @param {string} key - Attribute key
 * @param {string} value - Attribute value
 */
TraceAttributes.prototype.set = function set(destinations, key, value) {
  this.attributes[key] = {
    value: value,
    destinations: destinations
  }
}

/**
 * Retrieves all attribute key-value pairs where the given `dest` is included
 * in the list of allowed destinations. If there is a limit on the number of
 * attributes allowed, no more than that number will be included in the result.
 *
 * @param {string} dest
 * @return {object}
 */
TraceAttributes.prototype.get = function get(dest) {
  var atts = {}
  var keys = Object.keys(this.attributes)
  var attCount = 0
  var i = attCount
  while (attCount < this.limit) {
    var key = keys[i]
    if (!key) {
      break
    }
    if (this.attributes[key].destinations.indexOf(dest) >= 0) {
      atts[key] = typeof this.attributes[key].value === 'string'
        ? truncate(this.attributes[key].value)
        : this.attributes[key].value
      attCount++
    }
    i++
  }
  return atts
}

// Trims a string value to 255 bytes, if necessary.
function truncate(val) {
  var l = val.length - 1
  while (!isValidLength(val)) {
    val = val.substring(0, l)
    l--
  }
  return val
}

/**
 * Checks if a given key exists in the instance attributes object.
 *
 * @param {string} key
 */
TraceAttributes.prototype.has = function has(key) {
  // `null` is considered valid, so only check against undefined
  return this.attributes[key] !== undefined
}
