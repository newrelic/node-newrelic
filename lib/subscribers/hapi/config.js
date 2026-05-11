/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  '@hapi/hapi': [
    {
      path: './hapi/route.js',
      instrumentations: [
        {
          channelName: 'nr_route',
          module: { name: '@hapi/hapi', versionRange: '>=20.1.2', filePath: 'lib/server.js' },
          functionQuery: {
            methodName: 'route',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './hapi/ext.js',
      instrumentations: [
        {
          channelName: 'nr_ext',
          module: { name: '@hapi/hapi', versionRange: '>=20.1.2', filePath: 'lib/server.js' },
          functionQuery: {
            methodName: 'ext',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './hapi/decorate.js',
      instrumentations: [
        {
          channelName: 'nr_decorate',
          module: { name: '@hapi/hapi', versionRange: '>=20.1.2', filePath: 'lib/server.js' },
          functionQuery: {
            methodName: 'decorate',
            kind: 'Sync'
          }
        }
      ]
    }
  ],
  '@hapi/vision': [
    {
      path: './hapi/render.js',
      instrumentations: [
        {
          channelName: 'nr_render',
          module: { name: '@hapi/vision', versionRange: '>=5.0.0', filePath: 'lib/index.js' },
          functionQuery: {
            expressionName: 'toolkitView',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
