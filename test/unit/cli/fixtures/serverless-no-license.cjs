/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Serverless mode exempts the license_key requirement, so this is startable
// despite having no license_key.
exports.config = {
  app_name: ['My Application'],
  serverless_mode: {
    enabled: true
  }
}
