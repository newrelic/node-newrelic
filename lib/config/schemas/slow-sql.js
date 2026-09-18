/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'slow-sql.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Enables and disables `slow_sql` recording.'
    },
    max_samples: {
      'x-newrelic-env-var': 'NEW_RELIC_MAX_SQL_SAMPLES',
      type: 'integer',
      default: 10,
      description: 'Sets the maximum number of slow query samples that will be collected in a single harvest cycle. env NEW_RELIC_MAX_SQL_SAMPLES'
    }
  },
  additionalProperties: true,
  description: 'These options control behavior for slow queries, but do not affect sql nodes in transaction traces.'
}
