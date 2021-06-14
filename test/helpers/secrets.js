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

module.exports = {
  getTestSecret
}
