'use strict'

var hasOwnProperty = Object.hasOwnProperty

// The logger needs to be lazy-loaded to get around ordering issues with config.
var _logger = null
var getLogger = function makeLogger() {
  _logger = require('../logger').child({component: 'util-properties'})
  getLogger = function reallyGetLogger() {
    return _logger
  }
  return _logger
}

/**
 * Checks if an object has its own property with the given key.
 *
 * It is possible to create objects which do not inherit from `Object` by doing
 * `Object.create(null)`. These objects do not have the `hasOwnProperty` method.
 * This method uses a cached version of `hasOwnProperty` to check for the
 * property, thus avoiding the potential `undefined is not a function` error.
 *
 * @private
 *
 * @param {*}       obj - The item to check for the property on.
 * @param {string}  key - The name of the property to look for.
 *
 * @return {bool} True if the given object has its own property with the given
 *  key.
 */
exports.hasOwn = function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key)
}

/**
 * Checks if a given object is empty.
 *
 * @param {*} obj - The object to check for properties on.
 *
 * @return {bool} True if the object has no keys of its own.
 */
exports.isEmpty = function isEmpty(obj) {
  // Use this case for null prototyped objects.
  for (var key in obj) {
    if (exports.hasOwn(obj, key)) {
      return false
    }
  }
  return true
}

/**
 * Sets a non-enumerable property on an object with the given value.
 *
 * XXX: This process is very slow, so use only when necessary. Check the
 * configuration `transaction_tracer.hide_internals` before calling this.
 *
 * @private
 *
 * @param {*}       obj   - The item to add the hidden property to.
 * @param {string}  name  - The name of the property to add.
 * @param {*}       val   - The value to set the property to.
 *
 * @return {*} The `obj` argument.
 */
exports.setInternal = function setInternalProperty(obj, name, val) {
  if (!obj || !name) {
    getLogger().debug('Not setting property; object or name is missing.')
    return obj
  }

  try {
    if (!exports.hasOwn(obj, name)) {
      Object.defineProperty(obj, name, {
        enumerable: false,
        writable: true,
        value: val
      })
    } else {
      obj[name] = val
    }
  } catch (err) {
    getLogger().debug(err, 'Failed to set property "%s" to %j', name, val)
  }
  return obj
}
