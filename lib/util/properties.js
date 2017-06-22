'use strict'

var hasOwnProperty = Object.hasOwnProperty

exports.hasOwn = function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key)
}
