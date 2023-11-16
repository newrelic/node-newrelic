/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const flatten = require('../util/flatten')

// Config keys that can't be set by the server if high_security is enabled
const HIGH_SECURITY_SETTINGS = {
  ssl: true,
  strip_exception_messages: {
    enabled: true
  },
  allow_all_headers: false,
  attributes: {
    include: []
  },
  transaction_tracer: {
    record_sql: 'obfuscated',
    attributes: {
      include: []
    }
  },
  error_collector: {
    attributes: {
      include: []
    }
  },
  browser_monitoring: {
    attributes: {
      include: []
    }
  },
  transaction_events: {
    attributes: {
      include: []
    }
  },
  span_events: {
    attributes: {
      include: []
    }
  },
  transaction_segments: {
    attributes: {
      include: []
    }
  },
  slow_sql: {
    enabled: false
  },
  application_logging: {
    forwarding: {
      enabled: false
    }
  },
  ai_monitoring: {
    enabled: false
  }
}

const HIGH_SECURITY_KEYS = flatten.keys(HIGH_SECURITY_SETTINGS)

// blank out these config values before sending to the collector
const REDACT_BEFORE_SEND = new Set([
  'proxy_pass',
  'proxy_user',
  'proxy',
  'certificates' // should be public but in case user mistake and also these are huge
])

// process.domain needs to be stripped befeore sending
const REMOVE_BEFORE_SEND = new Set(['domain'])

exports.HIGH_SECURITY_SETTINGS = HIGH_SECURITY_SETTINGS
exports.HIGH_SECURITY_KEYS = HIGH_SECURITY_KEYS
exports.REDACT_BEFORE_SEND = REDACT_BEFORE_SEND
exports.REMOVE_BEFORE_SEND = REMOVE_BEFORE_SEND
