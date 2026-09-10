/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'error-collector.js',
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'If `true`, the agent captures attributes from error collection.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude from error collection. Allows * as wildcard at end.'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in error collection. Allows * as wildcard at end.'
        }
      },
      additionalProperties: true
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: "Disabling the error tracer just means that errors aren't collected and sent to New Relic -- it DOES NOT remove any instrumentation."
    },
    ignore_status_codes: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [
        404
      ],
      description: 'List of HTTP error status codes the error tracer should disregard. Ignoring a status code means that the transaction is not renamed to match the code, and the request is not treated as an error by the error collector. NOTE: This configuration value has no effect on errors recorded using `noticeError()`. Defaults to 404 NOT FOUND.'
    },
    capture_events: {
      type: 'boolean',
      default: true,
      description: 'Whether error events are collected.'
    },
    max_event_samples_stored: {
      type: 'integer',
      default: 100,
      description: "The agent will collect all error events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
    },
    expected_classes: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: []
    },
    expected_messages: {
      type: 'object',
      additionalProperties: true,
      default: {}
    },
    expected_status_codes: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: []
    },
    ignore_classes: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: []
    },
    ignore_messages: {
      type: 'object',
      additionalProperties: true,
      default: {}
    }
  },
  additionalProperties: true,
  description: 'Whether to collect & submit error traces to New Relic.'
}
