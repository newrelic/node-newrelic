/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const limits = require('./limits.cjs')

module.exports.config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  high_security: false,

  attributes: {
    enabled: true,
    value_size_limit: limits.valueSizeLimit
  }
}
