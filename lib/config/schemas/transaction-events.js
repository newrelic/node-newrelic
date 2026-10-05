/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'transaction-events.js',
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'If `true`, the agent captures attributes from transaction events.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_EXCLUDE'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in transaction events. Allows * as wildcard at end. env NEW_RELIC_TRANSACTION_EVENTS_ATTRIBUTES_INCLUDE'
        }
      },
      additionalProperties: true
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: 'If this is disabled, the agent does not collect, nor try to send, analytic data.'
    },
    max_samples_stored: {
      type: 'integer',
      default: 10000,
      description: 'The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected.'
    }
  },
  additionalProperties: true,
  description: 'Transaction Events Transaction events are sent to New Relic Insights. This event data includes transaction timing, transaction name, and any custom parameters. Read more here: http://newrelic.com/insights'
}
