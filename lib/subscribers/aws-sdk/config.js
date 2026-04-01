/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const sendConfig = {
  path: './aws-sdk/send.js',
  instrumentations: [
    // CJS
    {
      channelName: 'nr_send',
      module: { name: '@smithy/smithy-client', versionRange: '>=4.0.0', filePath: 'dist-cjs/index.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_send',
      module: { name: '@smithy/smithy-client', versionRange: '>=1.0.0 <4.0.0', filePath: 'dist-cjs/index.js' },
      functionQuery: {
        className: '_Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    // ESM
    {
      channelName: 'nr_send',
      module: { name: '@smithy/smithy-client', versionRange: '>=4.0.0', filePath: 'dist-es/index.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_send',
      module: { name: '@smithy/smithy-client', versionRange: '>=1.0.0 <4.0.0', filePath: 'dist-es/index.js' },
      functionQuery: {
        className: '_Client',
        methodName: 'send',
        kind: 'Sync'
      }
    }
  ]
}

const legacySendConfig = {
  path: './aws-sdk/legacy-send.js',
  instrumentations: [
    {
      channelName: 'nr_send',
      module: { name: '@aws-sdk/smithy-client', versionRange: '>=1.0.0 <3.35.0', filePath: 'dist/cjs/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_send',
      module: { name: '@aws-sdk/smithy-client', versionRange: '>=1.0.0 <3.35.0', filePath: 'dist/es/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    // Cap at 3.374.0 because that version replaced the Client class with a
    // re-export of @smithy/smithy-client, so dist-cjs/client.js no longer exists.
    {
      channelName: 'nr_send',
      module: { name: '@aws-sdk/smithy-client', versionRange: '>=3.35.0 <3.374.0', filePath: 'dist-cjs/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    },
    {
      channelName: 'nr_send',
      module: { name: '@aws-sdk/smithy-client', versionRange: '>=3.35.0 <3.374.0', filePath: 'dist-es/client.js' },
      functionQuery: {
        className: 'Client',
        methodName: 'send',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@smithy/smithy-client':
    [
      sendConfig
    ],
  '@aws-sdk/smithy-client':
    [
      legacySendConfig
    ]
}
