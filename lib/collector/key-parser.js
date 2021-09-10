/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports.parseKey = function parseKey(licenseKey) {
  const regionMatch = /^(.+?)x/.exec(licenseKey)
  return regionMatch && regionMatch[1]
}
