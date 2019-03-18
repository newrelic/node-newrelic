'use strict'

const Config = require('./config')
const logger = require('./logger').child({component: 'attributes'})
const isValidType = require('./util/attribute-types')
const byteUtils = require('./util/byte-limit')
const properties = require('./util/properties')

/**
 * @class
 * @private
 */
class Attributes {
  /**
   * @param {string} scope
   *  The scope of the attributes this will collect. Must be `transaction` or
   *  `segment`.
   *
   * @param {number} [limit=Infinity]
   *  The maximum number of attributes to retrieve for each destination.
   */
  constructor(scope, limit = Infinity) {
    this.filter = makeFilter(scope)
    this.limit = limit
    this.attributes = Object.create(null)
  }

  /**
   * Checks if a given string is within agent attribute limits.
   *
   * @param {string} str - Object key name or value
   */
  isValidLength(str) {
    return typeof str === 'number' || byteUtils.isValidLength(str, 255)
  }

  /**
   * Adds the given attribute to the instance attributes object,
   * overwriting existing keys if necessary.
   *
   * @param {AttributeFilter.DESTINATIONS} destinations - Allowed destinations
   * @param {string}  key            - Attribute key
   * @param {string}  value          - Attribute value
   * @param {boolean} truncateExempt - Flag marking value exempt from truncation
   */
  _set(destinations, key, value, truncateExempt) {
    this.attributes[key] = {value, destinations, truncateExempt}
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
      if (!(attr.destinations & dest)) {
        continue
      }

      attrs[key] = typeof attr.value === 'string' && !attr.truncateExempt
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
    return !!this.attributes[key]
  }

  /**
   * Clears instance attributes. Used for enforcing updated LASP
   * settings on connect.
   */
  reset() {
    this.attributes = Object.create(null)
  }

  /**
   * Adds given key-value pair to destination's agent attributes,
   * if it passes filtering rules.
   *
   * @param {DESTINATIONS}  destinations  - The default destinations for this key.
   * @param {string}        key           - The attribute name.
   * @param {string}        value         - The attribute value.
   * @param {boolean} [truncateExempt=false] - Flag marking value exempt from truncation
   */
  addAttribute(destinations, key, value, truncateExempt = false) {
    if (!isValidType(value)) {
      return logger.debug(
        'Not adding attribute %s with %s value type. This is expected for undefined' +
        'attributes and only an issue if an attribute is not expected to be undefined' +
        'or not of the type expected.',
        key,
        typeof value
      )
    }

    if (!this.isValidLength(key)) {
      return logger.warn(
        'Length limit exceeded for attribute name, not adding: %s',
        key
      )
    }

    // Only set the attribute if at least one destination passed
    const validDestinations = this.filter(destinations, key)
    if (validDestinations) {
      this._set(validDestinations, key, value, truncateExempt)
    }
  }

  /**
   * Passthrough method for adding multiple unknown attributes at once.
   *
   * @param {DESTINATIONS}  destinations  - The default destinations for these attributes.
   * @param {object}        attrs         - The attributes to add.
   */
  addAttributes(destinations, attrs) {
    for (let key in attrs) {
      if (properties.hasOwn(attrs, key)) {
        this.addAttribute(destinations, key, attrs[key])
      }
    }
  }
}

/**
 * Creates a filter function for the given scope.
 *
 * @param {string} scope - The scope of the filter to make.
 *
 * @return {function} A function that performs attribute filtering for the given
 *  scope.
 */
function makeFilter(scope) {
  const {attributeFilter} = Config.getInstance()
  if (scope === 'transaction') {
    return (d, k) => attributeFilter.filterTransaction(d, k)
  } else if (scope === 'segment') {
    return (d, k) => attributeFilter.filterSegment(d, k)
  }
}

module.exports = Attributes
