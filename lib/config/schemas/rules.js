/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'rules.js',
  type: 'object',
  properties: {
    name: {
      'x-newrelic-env-var': 'NEW_RELIC_NAMING_RULES',
      'x-newrelic-coerce': 'objectList',
      type: 'array',
      items: {},
      default: [],
      description: "A list of rules of the format {pattern: 'pattern', name: 'name'} for matching incoming request URLs and naming the associated New Relic transactions. Both pattern and name are required. Additional attributes are ignored. Patterns may have capture groups (following JavaScript conventions), and names will use $1-style replacement strings. See the documentation for addNamingRule for important caveats."
    },
    ignore: {
      'x-newrelic-env-var': 'NEW_RELIC_IGNORING_RULES',
      type: 'array',
      // Patterns may be strings or regular expressions; a RegExp is an object
      // to the validator.
      items: {
        type: ['string', 'object']
      },
      default: [
        '^/socket.io/.*/xhr-polling/'
      ],
      description: 'A list of patterns for matching incoming request URLs to be ignored by the agent. Patterns may be strings or regular expressions. By default, socket.io long-polling is ignored. env NEW_RELIC_IGNORING_RULES'
    }
  },
  additionalProperties: true,
  description: 'Rules for naming or ignoring transactions.'
}
