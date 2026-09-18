/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'api.js',
  type: 'object',
  properties: {
    custom_attributes_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_API_CUSTOM_ATTRIBUTES',
      type: 'boolean',
      default: true,
      description: 'Controls for the `API.addCustomAttribute` method.'
    },
    custom_events_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_API_CUSTOM_EVENTS',
      type: 'boolean',
      default: true,
      description: 'Controls for the `API.recordCustomEvent` method.'
    },
    notice_error_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_API_NOTICE_ERROR',
      type: 'boolean',
      default: true,
      description: 'Controls for the `API.noticeError` method.'
    }
  },
  additionalProperties: true,
  description: 'API Configuration Some API end points can be turned off via configuration settings to allow for more flexible security options. All API configuration options are disabled when high-security mode is enabled.'
}
