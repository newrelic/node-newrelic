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
          'x-newrelic-env-var': 'NEW_RELIC_DATASTORE_INSTANCE_REPORTING_ENABLED',
          type: 'boolean',
          default: true,
          description: 'When true (the default), reports the datastore host and port, path, or ID. When false, removes host and port_path_or_id from datastore segments and disables datastore instance metrics. Does not affect database name reporting.'
        }
      },
      additionalProperties: true,
      description: 'Controls reporting of datastore server connection details and instance metrics.'
    },
    database_name_reporting: {
      type: 'object',
      properties: {
        enabled: {
          'x-newrelic-env-var': 'NEW_RELIC_DATASTORE_DATABASE_NAME_REPORTING_ENABLED',
          type: 'boolean',
          default: true,
          description: 'When true (the default), reports the database or schema name. When false, removes database_name from datastore segments. Does not affect datastore instance reporting.'
        }
      },
      additionalProperties: true,
      description: 'Controls reporting of database and schema names.'
    }
  },
  additionalProperties: true,
  description: 'Controls which datastore connection details the agent reports. Instance reporting and database name reporting are enabled by default and can be disabled independently.'
}
