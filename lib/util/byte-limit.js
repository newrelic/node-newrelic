'use strict'

const LARGER_THAN_LIMIT = 1
const EQUALS_LIMIT = 0
const SMALLER_THAN_LIMIT = -1

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
    return EQUALS_LIMIT
  }
  if (len < limit) {
    return SMALLER_THAN_LIMIT
  }
  return LARGER_THAN_LIMIT
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
  var delta = Math.ceil(l / 2)
  var cmpVal = compareLength(val.substring(0, l), limit)

  // Continue the binary search till:
  // 1) The string is the desired length (i.e. cmpVal = 0) OR
  // 2) The desired string must split a character to acheive the desired byte length
  //    In this case, we should cut the character that would be split.
  //    (i.e. delta > 1 character OR the string is larger than the limit)
  while (cmpVal && (cmpVal !== SMALLER_THAN_LIMIT || delta > 1)) {
    l = cmpVal === SMALLER_THAN_LIMIT ? l + delta : l - delta
    cmpVal = compareLength(val.substring(0, l), limit)
    delta = Math.ceil(delta / 2)
  }

  return val.substring(0, l)
}

module.exports.isValidLength = isValidLength
module.exports.compareLength = compareLength
module.exports.truncate = truncate
