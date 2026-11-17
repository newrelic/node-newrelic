/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const description = require('#agentlib/config/description.js')
const nmDescription = description`
Deprecated as of newrelic@14.11.0. Virtual Machine (VM) metrics are now
built-in to the agent. Please use 'virtual_machine.collect_metrics.enabled'
to manage VM metrics collection.
`

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'plugins.js',
  type: 'object',
  properties: {
    native_metrics: {
      type: 'object',
      properties: {
        enabled: {
          'x-newrelic-deprecated': '2026-11-12',
          'x-newrelic-env-var': 'NEW_RELIC_NATIVE_METRICS_ENABLED',
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: nmDescription
    }
  },
  additionalProperties: true
}
