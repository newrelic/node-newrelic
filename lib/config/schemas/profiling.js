/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'profiling.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false
    },
    include: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [
        'cpu',
        'heap'
      ],
      description: 'List of profile type names to enable. Only cpu and heap profiles are currently supported'
    },
    delay: {
      type: 'integer',
      default: 0,
      description: 'Delay in milliseconds before starting profiler.'
    },
    duration: {
      type: 'integer',
      default: 0,
      description: 'If >0, stop profiler after this many milliseconds of operation.'
    },
    source_mapping: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false,
          description: 'When set to `true`, resolves profiler frames to their original source files/lines using source maps, instead of the compiled output.'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls the behavior of the profiler.'
}
