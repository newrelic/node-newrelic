'use strict'

const byteUtils = require('../../util/byte-limit')

module.exports = TraceAttributes

/**
 * @class
 * @private
 */
function TraceAttributes(opts) {
  opts = opts || Object.create(null)
  this.limit = opts.limit || Infinity
  this.attributes = Object.create(null)
  this.count = 0
}

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
 */
TraceAttributes.prototype.isValidLength = isValidLength
function isValidLength(str) {
  return byteUtils.isValidLength(str, 256)
}

/**
 * Adds the given attribute to the instance attributes object,
 * overwriting existing keys if necessary.
 *
 * @param {AttributeFilter.DESTINATIONS} destinations - Allowed destinations
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
 * @param {AttributeFilter.DESTINATIONS} dest
 * @return {object}
 */
TraceAttributes.prototype.get = function get(dest) {
  var attrs = Object.create(null)
  var attrCount = 0
  for (var key in this.attributes) { // eslint-disable-line guard-for-in
    var attr = this.attributes[key]
    if (!(attr.destinations & dest) || !isValidType(attr.value)) {
      continue
    }

    attrs[key] = typeof attr.value === 'string'
      ? byteUtils.truncate(attr.value, 255)
      : attr.value

    if (++attrCount >= this.limit) {
      break
    }
  }

  return attrs
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

/**
 * Clears instance attributes and count. Used for enforcing updated LASP
 * settings on connect.
 */
TraceAttributes.prototype.reset = function reset() {
  this.count = 0
  this.attributes = Object.create(null)
}

/**
 * Checks incoming attribute value against valid types:
 * string, number, boolean, & null.
 *
 * @param {*} val
 *
 * @return {boolean}
 */
function isValidType(val) {
  return val === null || typeof val !== 'object' && val !== undefined
}
