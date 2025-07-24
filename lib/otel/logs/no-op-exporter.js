/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { ExportResultCode } = require('@opentelemetry/core')

/**
 * @see https://open-telemetry.github.io/opentelemetry-js/interfaces/_opentelemetry_sdk-node.logs.LogRecordExporter.html
 */
class NewRelicNoOpExporter {
  export(_, done) {
    if (typeof done === 'function') {
      done(ExportResultCode.SUCCESS)
    }
  }

  shutdown() {
    return Promise.resolve()
  }
}

module.exports = NewRelicNoOpExporter
