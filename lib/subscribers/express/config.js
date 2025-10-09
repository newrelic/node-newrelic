/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  express: [
    {
      path: './express/use.js',
      instrumentations: [
        {
          channelName: 'nr_use',
          module: { name: 'express', versionRange: '>=4.15.0', filePath: 'lib/router/index.js' },
          functionQuery: {
            expressionName: 'use',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './express/route.js',
      instrumentations: [
        {
          channelName: 'nr_route',
          module: { name: 'express', versionRange: '>=4.15.0', filePath: 'lib/router/index.js' },
          functionQuery: {
            expressionName: 'route',
            kind: 'Sync'
          }
        },
      ]
    },
    {
      path: './express/param.js',
      instrumentations: [
        {
          channelName: 'nr_param',
          module: { name: 'express', versionRange: '>=4.15.0', filePath: 'lib/router/index.js' },
          functionQuery: {
            expressionName: 'param',
            kind: 'Sync'
          }
        },
      ]
    },
    {
      path: './express/render.js',
      instrumentations: [
        {
          channelName: 'nr_render',
          module: { name: 'express', versionRange: '>=4.15.0', filePath: 'lib/response.js' },
          functionQuery: {
            expressionName: 'render',
            kind: 'Sync'
          }
        },
      ]
    }
  ],
  router: [
    {
      path: './express/router-use.js',
      instrumentations: [
        {
          channelName: 'nr_use',
          module: { name: 'router', versionRange: '>=2.0.0', filePath: 'index.js' },
          functionQuery: {
            expressionName: 'use',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './express/router-route.js',
      instrumentations: [
        {
          channelName: 'nr_route',
          module: { name: 'router', versionRange: '>=2.0.0', filePath: 'index.js' },
          functionQuery: {
            expressionName: 'route',
            kind: 'Sync'
          }
        }
      ]
    },
    {
      path: './express/router-param.js',
      instrumentations: [
        {
          channelName: 'nr_param',
          module: { name: 'router', versionRange: '>=2.0.0', filePath: 'index.js' },
          functionQuery: {
            expressionName: 'param',
            kind: 'Sync'
          }
        },
      ]
    }
  ]
}
