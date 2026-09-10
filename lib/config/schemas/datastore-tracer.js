/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'datastore-tracer.js',
  type: 'object',
  properties: {
    instance_reporting: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true
    },
    database_name_reporting: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Controls behavior of datastore instance metrics. Enables reporting the host and port/path/id of database servers. Default is `true`. Enables reporting of database/schema names. Default is `true`.'
}
