/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Config = require('./config')
const logger = require('./logger').child({ component: 'attributes' })
const isValidType = require('./util/attribute-types')
const byteUtils = require('./util/byte-limit')
const properties = require('./util/properties')

const MAXIMUM_CUSTOM_ATTRIBUTES = 64
const MAXIMUM_ATTR_VALUE_LENGTH = 4_096

/**
 * @class
 * @private
 */
class Attributes {
  static SCOPE_TRANSACTION = 'transaction'
  static SCOPE_SEGMENT = 'segment'

  /**
   * @param {object} params Constructor parameters.
   * @param {string} params.scope
   *  The scope of the attributes this will collect. Must be `transaction` or
   *  `segment`.
   * @param {number} [params.limit]
   *  The maximum number of attributes to retrieve for each destination.
   * @param {number} [params.valueLengthLimit] The maximum length allowed for
   * attribute values.
   */
  constructor({ scope, limit = Infinity, valueLengthLimit = 256 } = {}) {
    this.filter = makeFilter(scope)
    this.limit = limit
    this.attributes = Object.create(null)
    this.attributeCount = 0
    this.attributeValueLimit = valueLengthLimit

    if (this.attributeValueLimit > MAXIMUM_ATTR_VALUE_LENGTH) {
      this.attributeValueLimit = MAXIMUM_ATTR_VALUE_LENGTH
    }
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
    this.attributes[key] = { value, destinations, truncateExempt }
  }

  /**
   * Retrieves all attribute key-value pairs where the given `dest` is included
   * in the list of allowed destinations. If there is a limit on the number of
   * attributes allowed, no more than that number will be included in the result.
   *
   * @param {AttributeFilter.DESTINATIONS} dest - Allowed destinations
   * @returns {object}
   */
  get(dest) {
    const attrs = Object.create(null)
    for (const key in this.attributes) {
      const attr = this.attributes[key]
      // eslint-disable-next-line sonarjs/bitwise-operators
      if (!(attr.destinations & dest)) {
        continue
      }

      attrs[key] =
        typeof attr.value === 'string' && !attr.truncateExempt
          ? byteUtils.truncate(attr.value, this.attributeValueLimit)
          : attr.value
    }

    return attrs
  }

  /**
   * Checks if a given key exists in the instance attributes object.
   *
   * @param {string} key the key to check
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
   * @param {boolean} [truncateExempt] - Flag marking value exempt from truncation
   */
  addAttribute(destinations, key, value, truncateExempt = false) {
    if (this.attributeCount + 1 > this.limit) {
      return logger.debug(
        `Maximum number of custom attributes have been added.
        Dropping attribute ${key} with ${value} type.`
      )
    }

    if (!isValidType(value)) {
      return logger.debug(
        'Not adding attribute %s with %s value type. This is expected for undefined ' +
          'attributes and only an issue if an attribute is not expected to be undefined ' +
          'or not of the type expected.',
        key,
        typeof value
      )
    }

    if (!this.isValidLength(key)) {
      return logger.warn('Length limit exceeded for attribute name, not adding: %s', key)
    }

    // Only set the attribute if at least one destination passed
    const validDestinations = this.filter(destinations, key)
    if (validDestinations) {
      this.attributeCount = this.attributeCount + 1
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
    for (const key in attrs) {
      if (properties.hasOwn(attrs, key)) {
        this.addAttribute(destinations, key, attrs[key])
      }
    }
  }

  /**
   * Returns true if a given key is valid for any of the
   * provided destinations.
   *
   * @param {DESTINATIONS} destinations - The destinations to check against.
   * @param {string} key the key to check
   */
  hasValidDestination(destinations, key) {
    const validDestinations = this.filter(destinations, key)
    return !!validDestinations
  }
}

/**
 * Creates a filter function for the given scope.
 *
 * @param {string} scope - The scope of the filter to make.
 * @returns {Function|undefined} A function that performs attribute filtering for the given
 *  scope, or undefined if the scope is not recognized.
 */
function makeFilter(scope) {
  const { attributeFilter } = Config.getInstance()
  switch (scope) {
    case Attributes.SCOPE_TRANSACTION: {
      return (d, k) => attributeFilter.filterTransaction(d, k)
    }

    case Attributes.SCOPE_SEGMENT: {
      return (d, k) => attributeFilter.filterSegment(d, k)
    }
  }
}

module.exports = {
  Attributes,
  MAXIMUM_CUSTOM_ATTRIBUTES
}
