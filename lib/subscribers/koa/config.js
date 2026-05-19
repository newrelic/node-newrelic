/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  koa: [
    {
      path: './koa/use.js',
      instrumentations: [
        {
          channelName: 'nr_use',
          module: {
            name: 'koa',
            filePath: 'lib/application.js',
            versionRange: '>=2.0.0'
          },
          functionQuery: {
            methodName: 'use',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
