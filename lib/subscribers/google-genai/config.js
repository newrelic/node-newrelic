/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const generateContentInternal = {
  path: './google-genai/generate-content.js',
  instrumentations: [
    {
      channelName: 'nr_generateContentInternal',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.cjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'generateContentInternal',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_generateContentInternal',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.mjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'generateContentInternal',
        kind: 'Async'
      }
    }
  ]
}

const generateContentStreamInternal = {
  path: './google-genai/generate-content-stream.js',
  instrumentations: [
    {
      channelName: 'nr_generateContentStreamInternal',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.cjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'generateContentStreamInternal',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_generateContentStreamInternal',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.mjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'generateContentStreamInternal',
        kind: 'Async'
      }
    }
  ]
}

const embedContent = {
  path: './google-genai/embed-content.js',
  instrumentations: [
    {
      channelName: 'nr_embedContent',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.cjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'embedContent',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_embedContent',
      module: { name: '@google/genai', versionRange: '>=1.1.0', filePath: 'dist/node/index.mjs' },
      functionQuery: {
        className: 'Models',
        methodName: 'embedContent',
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  '@google/genai': [
    generateContentInternal,
    generateContentStreamInternal,
    embedContent
  ]
}
