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
  description: 'Settings for integration with Agent Control. Set by Agent Control, not user-facing.',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Indicates that the agent is managed by Agent Control. When true, the agent periodically writes health status files to `health.delivery_location`.'
    },
    health: {
      type: 'object',
      description: 'Settings for the health status files the agent writes for Agent Control.',
      properties: {
        delivery_location: {
          type: 'string',
          default: 'file:///newrelic/apm/health',
          description: 'The directory the agent writes health status files to, as a `file://` URL or a plain file system path. The directory must already exist and be writable, or health reporting is skipped.'
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
  additionalProperties: true
}
