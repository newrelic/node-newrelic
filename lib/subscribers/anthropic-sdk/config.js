/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const messagesCreate = {
  path: './anthropic-sdk/create.js',
  instrumentations: [
    {
      channelName: 'nr_create',
      module: { name: '@anthropic-ai/sdk', versionRange: '>=0.33.0', filePath: 'resources/messages/messages.js' },
      functionQuery: {
        className: 'Messages',
        methodName: 'create',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  '@anthropic-ai/sdk': [
    messagesCreate
  ]
}
