/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'url-obfuscation.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: false,
      description: 'Toggles whether to obfuscate URL parameters'
    },
    regex: {
      type: 'object',
      properties: {
        pattern: {
          'x-newrelic-coerce': 'regex',
          type: 'string',
          description: 'Must be a valid regular expression.',
          default: null
        },
        flags: {
          type: 'string',
          default: '',
          description: 'A string containing RegEx flags to use when matching URL parameters'
        },
        replacement: {
          type: 'string',
          default: '',
          description: 'A string containing a replacement value for URL parameters can contain references to capture groups in the pattern'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true,
  description: 'Obfuscates URL parameters for outgoing and incoming requests for distributed tracing attributes - both transaction and span attributes for transaction trace transaction details'
}
