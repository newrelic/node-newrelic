/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Schema-valid and otherwise complete, but the agent is disabled — a hard
// startup blocker.
exports.config = {
  app_name: ['My Application'],
  license_key: 'license key here',
  agent_enabled: false
}
