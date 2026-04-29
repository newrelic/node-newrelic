/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  // Common http transaction trace attributes
  httpAttributes: ['request.headers.host', 'request.method', 'http.statusCode', 'http.statusText'],
  // Default config for attribute filter
  defaultAttributeConfig: () => {
    return {
      attributes: {
        enabled: true,
        include_enabled: true,
        include: [],
        exclude: []
      },

      transaction_events: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      transaction_tracer: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      error_collector: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      browser_monitoring: {
        attributes: {
          enabled: false,
          include: [],
          exclude: []
        }
      },

      span_events: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      },

      transaction_segments: {
        attributes: {
          enabled: true,
          include: [],
          exclude: []
        }
      }
    }
  }
}
