/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'transaction-segments.js',
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'If `true`, the agent captures attributes from transaction segments.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude in transaction segments. Allows * as wildcard at end.'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in transaction segments. Allows * as wildcard at end.'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls the behavior of transaction segments produced by the agent.'
}
