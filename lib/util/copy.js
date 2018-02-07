'use strict'

var hasOwnProperty = require('./properties').hasOwn

exports.shallow = shallowCopy

/**
 * Performs a shallow copy of all properties on the source object.
 *
 * @param {object} source     - The object to copy the properties from.
 * @param {object} [dest={}]  - The object to copy the properties to.
 *
 * @return {object} The destination object.
 */
function shallowCopy(source, dest) {
  dest = dest || Object.create(null)
  for (var k in source) {
    if (hasOwnProperty(source, k)) {
      dest[k] = source[k]
    }
  }
  return dest
}
