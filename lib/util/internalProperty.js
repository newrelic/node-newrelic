'use strict'

var logger = require('../logger').child({component: 'util-internal-prop'})
var properties = require('./properties')

function _setInternalProperty(obj, name, val) {
  if (!obj || !name) {
    logger.debug('Not setting property; object or name is missing.')
    return obj
  }

  try {
    if (!properties.hasOwn(obj, name)) {
      Object.defineProperty(obj, name, {
        enumerable: false,
        writable: true,
        value: val
      })
    } else {
      obj[name] = val
    }
  } catch (err) {
    logger.debug({err: err}, 'Failed to set property "%s" to %j', name, val)
  }
  return obj
}

module.exports.setInternalProperty = _setInternalProperty
