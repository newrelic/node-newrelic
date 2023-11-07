/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

// The logger needs to be lazy-loaded to get around ordering issues with config.
let logger = null

exports.satisfies = satisfies
exports.prerelease = prerelease

/**
 * Safely checks if the process version satisfies the given semver range.
 *
 * @param {string} check - The semantic version range to check.
 * @returns {boolean} True if the process version satisfies the given version, false
 *  otherwise.
 */
function satisfies(check) {
  try {
    return semver.satisfies(process.version, check)
  } catch (e) {
    _logWarn(e, 'Bad process version for satisfies check.')
    return false
  }
}

/**
 * Safely checks if the process version is a pre-release version.
 *
 * @returns {boolean} True if the process version is pre-release, false otherwise.
 */
function prerelease() {
  try {
    return semver.prerelease(process.version)
  } catch (e) {
    _logWarn(e, 'Bad process version for prelease check.')
    return false
  }
}

function _logWarn() {
  if (!logger) {
    logger = require('../logger').child({ component: 'util-process-version' })
  }
  logger.warn.apply(logger, arguments)
}
