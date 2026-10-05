/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'strip-exception-messages.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'When `true`, the agent will redact the messages of captured errors.'
    }
  },
  additionalProperties: true,
  description: 'Error message redaction Options regarding how the agent handles the redaction of error messages.'
}
