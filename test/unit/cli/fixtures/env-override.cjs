/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// `attributes.enabled` is the wrong type in the file; a NEW_RELIC_* environment
// variable can override it. Used to prove environment overrides are applied
// before validation, consistent with how the agent builds its config.
exports.config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  attributes: {
    enabled: 'not-a-boolean'
  }
}
