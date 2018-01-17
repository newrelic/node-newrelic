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

TraceAttributes.prototype.checkLimits = function checkLimits(key) {
  // if key exists, it's already passed validation
  if (!this.attributes[key]) {
    // If adding a new prop puts it over the limit, throw an error and don't add it
    if ((Object.keys(this.attributes).length + 1) > this.limit) {
      throw new Error('Trace attribute limit reached, not adding new attribute')
    }
    // If the key
    if (key.length > 255) {
      throw new Error(
        'Character limit exceeded for attribute name, not adding to transaction trace'
      )
    }
  }
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
    value: typeof value === 'string' ? value.substring(0, 255) : value,
    destinations: destinations
  }
}

/**
 * Retrieves all attribute key-value pairs where the given `dest` is included
 * in the list of allowed destinations.
 *
 * @param {string} dest
 * @return {object}
 */
TraceAttributes.prototype.get = function get(dest) {
  var atts = this.attributes
  return Object.keys(atts).reduce(function filterDests(obj, key) {
    if (atts[key].destinations.indexOf(dest) >= 0) {
      obj[key] = atts[key].value
    }
    return obj
  }, {})
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
