/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'audit-log.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enables logging of out bound traffic from the Agent to the Collector. This field is ignored if trace level logging is enabled. With trace logging, all traffic is logged.'
    },
    endpoints: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: 'Specify which methods are logged. Used in conjunction with the audit_log flag If audit_log is enabled and this property is empty, all methods will be logged Otherwise, if the audit log is enabled, only the methods specified in the filter will be logged Methods include: error_data, metric_data, and analytic_event_data'
    }
  },
  additionalProperties: true
}
