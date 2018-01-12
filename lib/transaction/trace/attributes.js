'use strict'

module.exports = TraceAttributes

/**
 * @class
 * @private
 */
function TraceAttributes() {
  this.attributes = {}
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
  return this.attributes[key] != null
}
