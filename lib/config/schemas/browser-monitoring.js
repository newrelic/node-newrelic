/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'browser-monitoring.js',
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false,
          description: 'If `true`, the agent captures attributes from browser monitoring.'
        },
        exclude: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to exclude from browser monitoring. Allows * as wildcard at end.'
        },
        include: {
          type: 'array',
          items: {
            type: 'string'
          },
          default: [],
          description: 'Prefix of attributes to include in browser monitoring. Allows * as wildcard at end.'
        }
      },
      additionalProperties: true
    },
    enable: {
      'x-newrelic-env-var': 'NEW_RELIC_BROWSER_MONITOR_ENABLE',
      type: 'boolean',
      default: true,
      description: 'Enable browser monitoring header generation. This does not auto-instrument, rather it enables the agent to generate headers. The newrelic module can generate the appropriate <script> header, but you must inject the header yourself, or use a module that does so. This generates the <script>...</script> header necessary for Browser Monitoring This script must be manually injected into your templates, as high as possible in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags. Otherwise you may hurt IE! This method must be called _during_ a transaction, and must be called every time you want to generate the headers. Do *not* reuse the headers between users, or even between requests.'
    },
    debug: {
      'x-newrelic-env-var': 'NEW_RELIC_BROWSER_MONITOR_DEBUG',
      type: 'boolean',
      default: false,
      description: 'Request un-minified sources from the server.'
    }
  },
  additionalProperties: true,
  description: 'Browser Monitoring Browser monitoring lets you correlate transactions between the server and browser giving you accurate data on how long a page request takes, from request, through the server response, up until the actual page render completes.'
}
