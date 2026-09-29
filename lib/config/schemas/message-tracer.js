/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'message-tracer.js',
  type: 'object',
  properties: {
    segment_parameters: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls behavior of message broker tracing. Enables reporting parameters on message broker segments.'
}
