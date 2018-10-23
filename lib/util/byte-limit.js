'use strict'

const makeBuffer = require('./hashes').makeBuffer


function isValidLength(str, limit) {
  return Buffer.byteLength(str) <= limit
}

/**
 * Checks if a given string is within agent attribute limits.
 *
 * @param {string} str - Object key name or value
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
  if (compareLength(val, limit) < 1) {
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
