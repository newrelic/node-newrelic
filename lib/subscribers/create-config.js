/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Builds a set of packages and instrumentations from a list of subscriber configurations.
 *
 * @param {Array} subscribers - An array of subscriber objects, each containing a package name and an array of instrumentations.
 * @returns {object} An object containing a Set of unique package names and an array of instrumentations.
 */
function createSubscribersConfig (subscribers = []) {
  const instrumentations = []
  for (const subscriberList of Object.values(subscribers)) {
    for (const subscriber of subscriberList) {
      instrumentations.push(...subscriber.instrumentations)
    }
  }

  return { instrumentations }
}

module.exports = createSubscribersConfig
