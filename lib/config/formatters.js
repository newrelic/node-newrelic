/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const formatters = module.exports

/**
 * Splits a string by a ',' and trims whitespace
 *
 * @param {string} val config setting
 * @param {Array}
 */
formatters.array = function array(val) {
  return val.split(',').map((k) => k.trim())
}

/**
 * Parses a config setting as an int
 *
 * @param {string} val config setting
 * @returns {int}
 */
formatters.int = function int(val) {
  return parseInt(val, 10)
}

/**
 * Parses a config setting as a float
 *
 * @param {string} val config setting
 * @returns {float}
 */
formatters.float = function float(val) {
  return parseFloat(val, 10)
}

/**
 * Parses a config setting as a boolean
 *
 * @param {string} val config setting
 * @param setting
 * @returns {boolean}
 */
formatters.boolean = function boolean(setting) {
  if (setting == null) {
    return false
  }

  const normalized = setting.toString().toLowerCase()
  switch (normalized) {
    case 'false':
    case 'f':
    case 'no':
    case 'n':
    case 'disabled':
    case '0':
      return false

    default:
      return true
  }
}

/**
 * Parses a config setting as an object
 *
 * @param {string} val config setting
 * @param {logger} logger agent logger instance
 * @returns {object}
 */
formatters.object = function object(val, logger) {
  try {
    return JSON.parse(val)
  } catch (error) {
    logger.error('New Relic configurator could not deserialize object:')
    logger.error(error.stack)
  }
}

/**
 * Parse a config setting as a collection with 1 object
 *
 * @param {string} val config setting
 * @param {logger} logger agent logger instance
 * @returns {Array}
 */
formatters.objectList = function objectList(val, logger) {
  try {
    return JSON.parse('[' + val + ']')
  } catch (error) {
    logger.error('New Relic configurator could not deserialize object list:')
    logger.error(error.stack)
  }
}

/**
 * Checks if a value is within an allow list. If not it assigns
 * the first element in allow list as default
 *
 * @param {Array} list allowable values
 * @param {string} val config setting
 * @returns {string}
 */
formatters.allowList = function allowList(list, val) {
  return list.includes(val) ? val : list[0]
}

/**
 * Parse a config setting as a regex
 *
 * @param {string} val valid regex
 * @param {logger} logger agent logger instance
 * @returns {RegExp} regex
 */
formatters.regex = function regex(val, logger) {
  try {
    return new RegExp(val)
  } catch (error) {
    logger.error(`New Relic configurator could not validate regex: ${val}`)
    logger.error(error.stack)
  }
}
