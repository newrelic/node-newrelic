'use strict'

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
 * @param {number} limit - String byte limit
 */
function isValidLength(str, limit) {
  return Buffer.byteLength(str, 'utf8') <= limit
}

/**
 * Returns the relative position of the end of the string (in bytes) and the limit.
 * >1 if the string is longer than the limit
 * 0 if the string is at the limit
 * <1 if the string is shorter than the limit
 *
 * @param {string} str
 * @param {number} limit - String byte limit
 */
function compareLength(str, limit) {
  return Buffer.byteLength(str) - limit
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
  var substrLen = val.length
  var delta = Math.ceil(substrLen / 2)
  var cmpVal = compareLength(val.substring(0, substrLen), limit)

  // Continue the binary search till:
  // 1) The string is the desired length (i.e. cmpVal = 0) OR
  // 2) The desired string must split a character to acheive the desired byte length
  //    In this case, we should cut the character that would be split.
  //    (i.e. delta > 1 character OR the string is larger than the limit)
  var substr
  while (cmpVal && (cmpVal > 0 || delta > 1)) {
    substrLen = cmpVal < 0 ? substrLen + delta : substrLen - delta
    substr = val.substring(0, substrLen)
    cmpVal = compareLength(substr, limit)
    delta = Math.ceil(delta / 2)
  }

  return substr
}

module.exports.isValidLength = isValidLength
module.exports.compareLength = compareLength
module.exports.truncate = truncate
