'use strict'

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
 * @param {number} limit - String byte limit
 */
function isValidLength(str, limit) {
  return Buffer.byteLength(str, 'utf8') < limit
}

/**
 * Trims a string value to given byte limit, if necessary.
 *
 * @private
 *
 * @param {string} val - The value to truncate to given byte limit.
 * @param {number} limit - The byte limit
 *
 * @return {string} The truncated value.
 */
function truncate(val, limit) {
  // First truncation handles the simple case of only one-byte characters.
  if (!isValidLength(val + 1)) {
    val = val.substring(0, limit)
  }

  // Our limitation is on byte length, and the string could contain multi-byte
  // characters. Doing a byte-substring could chop a character in half. We need
  // to pop the remaining characters off one by one until we have a good length.
  var l = val.length
  while (!isValidLength(val, limit + 1)) {
    val = val.substring(0, --l)
  }
  return val
}

module.exports.isValidLength = isValidLength
module.exports.truncate = truncate
