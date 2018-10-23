'use strict'

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
 * @param {number} limit - String byte limit
 */
function isValidLength(str, limit) {
  return Buffer.byteLength(str) <= limit
}

/**
 * Returns the relative position of the end of the string (in bytes) and the limit.
 * 1 if the string is longer than the limit
 * 0 if the string is at the limit
 * -1 if the string is shorter than the limit
 *
 * @param {string} str
 * @param {number} limit - String byte limit
 */
function compareLength(str, limit) {
  const len = Buffer.byteLength(str)
  if (len === limit) {
    return 0
  }
  if (len < limit) {
    return -1
  }
  return 1
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
  val = val.substring(0, limit)
  if (isValidLength(val, limit)) {
    return val
  }


  // Our limitation is on byte length, and the string could contain multi-byte
  // characters. Doing a byte-substring could chop a character in half. Instead
  // we do a binary search over the byte length of the substrings.
  var l = val.length
  var delta = Math.ceil(l/2)
  var cmpVal = compareLength(val.substring(0, l), limit)
  while (cmpVal) {
    l = cmpVal < 1 ? l + delta : l - delta
    cmpVal = compareLength(val.substring(0, l), limit)
    delta = Math.ceil(delta/2)
  }

  return val.substring(0, l)
}

module.exports.isValidLength = isValidLength
module.exports.compareLength = compareLength
module.exports.truncate = truncate
