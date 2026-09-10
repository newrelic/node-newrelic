/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'infinite-tracing.js',
  type: 'object',
  properties: {
    trace_observer: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          default: '',
          description: 'The URI HOST of the observer. Setting this enables infinite tracing.'
        },
        port: {
          type: 'integer',
          default: 443,
          description: 'The URI PORT of the observer.'
        }
      },
      additionalProperties: true
    },
    span_events: {
      type: 'object',
      properties: {
        queue_size: {
          type: 'integer',
          default: 10000,
          description: 'The amount of spans to hold onto before dropping them'
        },
        batch_size: {
          type: 'integer',
          default: 750,
          description: 'Size of batches to post to 8T server'
        }
      },
      additionalProperties: true
    },
    batching: {
      type: 'boolean',
      default: true
    },
    compression: {
      type: 'boolean',
      default: true
    }
  },
  additionalProperties: true,
  description: 'Controls the use of infinite tracing.'
}
