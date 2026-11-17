/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const description = require('../description.js')

const metricsDescription = description`
When enabled, metrics about the V8 virtual machine will be collected. Metrics
include information pertaining to garbage collection, memory usage, and CPU
usage. This will populate the "Node VMs" section of the monitored application's
dashboard.
`

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'virtual-machine.js',
  type: 'object',
  properties: {
    collect_metrics: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: metricsDescription
        }
      }
    }
  },
  additionalProperties: true
}
