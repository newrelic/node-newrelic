/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'span-events.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enables/disables span event generation'
    },
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'If `true`, the agent captures attributes from span events.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude in span events. Allows * as wildcard at end.'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in span events. Allows * as wildcard at end.'
        }
      },
      additionalProperties: true
    },
    max_samples_stored: {
      type: 'integer',
      default: 2000,
      description: 'The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected.'
    }
  },
  additionalProperties: true,
  description: 'Controls the behavior of span events produced by the agent.'
}
