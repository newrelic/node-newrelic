/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * A helper function to get secrets needed by tests
 */
function getTestSecret(secretName) {
  const envVar = process.env[secretName] || ''
  return envVar.trim()
}

/**
 * Checks whether any of the secrets needed by the test are missing or if the
 * FORCE_RUN_TESTS_WITH_SECRETS env var is set. This is set by the github
 * actions workflow when tests are being run on the newrelic repository where
 * secrets should be available. In this case, even if the license key that a
 * test is looking for is not present, run the test anyway and let it fail,
 * because it should be present on the newrelic repo.
 */
function shouldSkipTest(...secrets) {
  const missing = secrets.some(s => !s)  // !s catches empty strings
  const forceTestRun = process.env.FORCE_RUN_TESTS_WITH_SECRETS === 'true'
  const shouldRun = forceTestRun || !missing
  return !shouldRun
}

module.exports = {
  getTestSecret,
  shouldSkipTest
}
