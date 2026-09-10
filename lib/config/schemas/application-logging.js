/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'application-logging.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Toggles the ability for all application logging features to be enabled.'
    },
    forwarding: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Toggles whether the agent gathers log records for sending to New Relic.'
        },
        max_samples_stored: {
          type: 'integer',
          default: 10000,
          description: 'Number of log records to send per minute to New Relic.'
        },
        labels: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: false,
              description: 'If `true`, the agent attaches labels to log records.'
            },
            exclude: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: [],
              description: 'A case-insensitive array containing the labels to exclude from log records.'
            }
          },
          additionalProperties: true
        }
      },
      additionalProperties: true
    },
    metrics: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Toggles whether the agent gathers logging metrics.'
        }
      },
      additionalProperties: true
    },
    local_decorating: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false,
          description: 'Toggles whether the agent performs log decoration on standard log output.'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls the behavior of Logs in Context within agent'
}
