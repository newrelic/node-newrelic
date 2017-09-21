'use strict'

var logger = require('../logger').child('util-process-version')
var semver = require('semver')

exports.satisfies = satisfies
exports.prerelease = prerelease

/**
 * Safely checks if the process version satisfies the given semver range.
 *
 * @param {string} check - The semantic version range to check.
 *
 * @return {bool} True if the process version satisfies the given version, false
 *  otherwise.
 */
function satisfies(check) {
  try {
    return semver.satisfies(process.version, check)
  } catch (e) {
    logger.warn(e, 'Bad process version for satisfies check.')
    return false
  }
}

/**
 * Safely checks if the process version is a pre-release version.
 *
 * @return {bool} True if the process version is pre-release, false otherwise.
 */
function prerelease() {
  try {
    return semver.prerelease(process.version)
  } catch (e) {
    logger.warn(e, 'Bad process version for prelease check.')
    return false
  }
}
