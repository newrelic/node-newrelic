/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  '@nestjs/core': [
    {
      path: './nestjs/instrumentation.js',
      instrumentations: [
        {
          channelName: 'nr_nestjs_unknown_error',
          module: {
            name: '@nestjs/core',
            versionRange: '>=8.0.0',
            filePath: 'exceptions/base-exception-filter.js'
          },
          functionQuery: {
            className: 'BaseExceptionFilter',
            methodName: 'handleUnknownError',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
