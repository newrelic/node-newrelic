/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Builds a set of packages and instrumentaions from a list of subscriber configurations.
 *
 * @param {Array} subscribers - An array of subscriber objects, each containing a package name and an array of instrumentations.
 * @returns {Object} An object containing a Set of unique package names and an array of instrumentations.
 */
function createSubscribersConfig (subscribers = []) {
  const packages = new Set()
  const instrumentations = []
  for (const [packageName, subscriberList] of Object.entries(subscribers)) {
    packages.add(packageName)
    for (const subscriber of subscriberList) {
      instrumentations.push(...subscriber.instrumentations)
    }
  }

  return { packages, instrumentations }
}

module.exports = createSubscribersConfig
