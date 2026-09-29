/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'code-level-metrics.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true
    }
  },
  additionalProperties: true,
  description: 'Toggles whether to capture code.* attributes on spans'
}
