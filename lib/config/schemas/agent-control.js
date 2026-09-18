/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'agent-control.js',
  type: 'object',
  'x-newrelic-internal': true,
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Indicates that the agent is being managed by Agent Control. Must be set to true for health monitoring.'
    },
    health: {
      type: 'object',
      properties: {
        delivery_location: {
          type: 'string',
          default: 'file:///newrelic/apm/health',
          description: 'A string file path to a directory that the agent is expected to write health status files to. Must be set for health monitoring to be enabled.'
        },
        frequency: {
          type: 'integer',
          default: 5,
          description: 'An integer representing how often the agent should write to the health status file(s), in seconds.'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Settings for integration with Agent Control. Set by Agent Control, not user-facing.'
}
