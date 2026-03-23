/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const modName = '@grpc/grpc-js'

module.exports = {
  [modName]: [
    {
      path: './grpcjs/server.js',
      instrumentations: [{
        channelName: 'nr_grpc_server',
        module: {
          name: modName,
          filePath: 'build/src/server.js',
          versionRange: '>=1.4.0'
        },
        functionQuery: {
          className: 'Server',
          methodName: 'register',
          kind: 'Sync'
        }
      }]
    },

    {
      path: './grpcjs/http2-stream.js',
      instrumentations: [{
        channelName: 'nr_grpc_stream',
        module: {
          name: modName,
          filePath: 'build/src/call-stream.js',
          versionRange: '>=1.4.0 <1.8.0'
        },
        functionQuery: {
          className: 'Http2CallStream',
          methodName: 'start',
          kind: 'Sync'
        }
      }]
    },

    {
      path: './grpcjs/resolving-call.js',
      instrumentations: [{
        channelName: 'nr_grpc_resolving',
        module: {
          name: modName,
          filePath: 'build/src/resolving-call.js',
          versionRange: '>=1.8.0'
        },
        functionQuery: {
          className: 'ResolvingCall',
          methodName: 'start',
          kind: 'Sync'
        }
      }]
    }
  ]
}
