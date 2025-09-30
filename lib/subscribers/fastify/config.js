/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  fastify: [
    {
      path: './fastify',
      instrumentations: []
    },
    {
      path: './fastify/add-hook',
      instrumentations: [
        {
          channelName: 'nr_addHook',
          module: { name: 'fastify', versionRange: '>=3.0.0', filePath: 'lib/hooks.js' },
          functionQuery: {
            expressionName: 'add',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './fastify/decorate',
      instrumentations: [
        {
          channelName: 'nr_decorate',
          module: { name: 'fastify', versionRange: '>=3.0.0', filePath: 'lib/decorate.js' },
          functionQuery: {
            functionName: 'decorateFastify',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
