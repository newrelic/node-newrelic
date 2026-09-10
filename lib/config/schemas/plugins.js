/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'plugins.js',
  type: 'object',
  properties: {
    native_metrics: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: true,
      description: 'Controls usage of the native metrics module which samples VM and event loop data.'
    }
  },
  additionalProperties: true
}
