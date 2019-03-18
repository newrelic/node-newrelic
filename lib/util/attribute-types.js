'use strict'

const VALID_ATTR_TYPES = new Set([
  'string',
  'number',
  'boolean'
])

/**
 * Checks incoming attribute value against valid types:
 * string, number, & boolean.
 *
 * @param {*} val
 *
 * @return {boolean}
 */
function isValidType(val) {
  return VALID_ATTR_TYPES.has(typeof val)
}

module.exports = isValidType
