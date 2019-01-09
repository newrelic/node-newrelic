'use strict'

const logger = require('../../logger').child({component: 'trace-attributes'})
const byteUtils = require('../../util/byte-limit')

/**
 * @class
 * @private
 */
class TraceAttributes {
  constructor(opts = Object.create(null)) {
    this.limit = opts.limit || Infinity
    this.attributes = Object.create(null)
    this.count = 0
  }

  /**
   * Checks if a given string is within agent attribute limits.
   *
   * @param {string} str - Object key name or value
   */
  isValidLength(str) {
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
  set(destinations, key, value) {
    this.attributes[key] = {value, destinations}
  }

  /**
   * Retrieves all attribute key-value pairs where the given `dest` is included
   * in the list of allowed destinations. If there is a limit on the number of
   * attributes allowed, no more than that number will be included in the result.
   *
   * @param {AttributeFilter.DESTINATIONS} dest
   * @return {object}
   */
  get(dest) {
    const attrs = Object.create(null)
    let attrCount = 0
    for (let key in this.attributes) { // eslint-disable-line guard-for-in
      const attr = this.attributes[key]
      if (!(attr.destinations & dest) || !isValidType(attr.value)) {
        if (attr.value === null) {
          logger.debug('Not including trace attribute (%s) with null value', key)
        }
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
  has(key) {
    return this.attributes[key] != null
  }

  /**
   * Clears instance attributes and count. Used for enforcing updated LASP
   * settings on connect.
   */
  reset() {
    this.count = 0
    this.attributes = Object.create(null)
  }
}

/**
 * Checks incoming attribute value against valid types:
 * string, number, & boolean.
 *
 * @param {*} val
 *
 * @return {boolean}
 */
function isValidType(val) {
  return typeof val !== 'object' && val !== undefined
}

module.exports = TraceAttributes
