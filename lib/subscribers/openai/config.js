/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  openai: [
    {
      path: './openai/chat.js',
      instrumentations: [
        {
          channelName: 'nr_completionsCreate',
          module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/chat/completions.js' },
          functionQuery: {
            className: 'Completions',
            methodName: 'create',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_completionsCreate',
          module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/chat/completions/completions.js' },
          functionQuery: {
            className: 'Completions',
            methodName: 'create',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './openai/chat-responses.js',
      instrumentations: [
        {
          channelName: 'nr_responses',
          module: { name: 'openai', versionRange: '>=4.87.0', filePath: 'resources/responses/responses.js' },
          functionQuery: {
            className: 'Responses',
            methodName: 'create',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './openai/client.js',
      instrumentations: [
        {
          channelName: 'nr_makeRequest',
          module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'core.js' },
          functionQuery: {
            className: 'APIClient',
            methodName: 'makeRequest',
            kind: 'Sync'
          }
        },
        {
          channelName: 'nr_makeRequest',
          module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'client.js' },
          functionQuery: {
            className: 'OpenAI',
            methodName: 'makeRequest',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './openai/embeddings.js',
      instrumentations: [
        {
          channelName: 'nr_embeddingsCreate',
          module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'resources/embeddings.js' },
          functionQuery: {
            className: 'Embeddings',
            methodName: 'create',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
