/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// OpenTelemetry is enabled; from this fixture's location the agent's own
// @opentelemetry/* packages resolve, so this is startable.
exports.config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  opentelemetry: {
    enabled: true
  }
}
