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
      description: 'When false, the agent does not record custom attributes from `addCustomAttribute`, `addCustomAttributes`, `addCustomSpanAttribute`, `addCustomSpanAttributes`, or the custom attributes passed to `noticeError`.'
    },
    custom_events_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_API_CUSTOM_EVENTS',
      type: 'boolean',
      default: true,
      description: 'When false, `recordCustomEvent` does not record events.'
    },
    notice_error_enabled: {
      'x-newrelic-env-var': 'NEW_RELIC_API_NOTICE_ERROR',
      type: 'boolean',
      default: true,
      description: 'When false, `noticeError` does not record errors.'
    }
  },
  additionalProperties: true,
  description: 'API Configuration Some API end points can be turned off via configuration settings to allow for more flexible security options. All API configuration options are disabled when high-security mode is enabled. It does not disable `noticeError`.'
}
