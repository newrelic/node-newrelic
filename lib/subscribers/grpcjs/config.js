/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  '@grprc/grpc-js': [
    {
      path: './grpcjs/server.js',
      instrumentations: [
        {
          channelName: 'nr_grpc_server',
          module: {
            name: '@grpc/grpc-js',
            versionRange: '>=1.4.0',
            filePath: 'build/src/server.js'
          },
          functionQuery: {
            className: 'Server',
            methodName: 'register',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
