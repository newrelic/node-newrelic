/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  '@koa/router': [
    {
      path: './koa/router-register.js',
      instrumentations: [
        {
          channelName: 'nr_register',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=12.0.1 <13.0.0' },
          functionQuery: { expressionName: 'register', kind: 'Sync' }
        },
        {
          channelName: 'nr_register',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=13.0.0 <15.0.0' },
          functionQuery: { className: 'Router', methodName: 'register', kind: 'Sync' }
        },
        {
          channelName: 'nr_register',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'Router', methodName: 'register', kind: 'Sync' }
        },
        {
          channelName: 'nr_register',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'RouterImplementation', methodName: 'register', kind: 'Sync' }
        }
      ]
    },
    {
      path: './koa/router-param.js',
      instrumentations: [
        {
          channelName: 'nr_param',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=12.0.1 <13.0.0' },
          functionQuery: { expressionName: 'param', kind: 'Sync' }
        },
        {
          channelName: 'nr_param',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=13.0.0 <15.0.0' },
          functionQuery: { className: 'Router', methodName: 'param', kind: 'Sync' }
        },
        {
          channelName: 'nr_param',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'Router', methodName: 'param', kind: 'Sync' }
        },
        {
          channelName: 'nr_param',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'RouterImplementation', methodName: 'param', kind: 'Sync' }
        }
      ]
    },
    {
      path: './koa/router-allowed-methods.js',
      instrumentations: [
        {
          channelName: 'nr_allowedMethods',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=12.0.1 <13.0.0' },
          functionQuery: { expressionName: 'allowedMethods', kind: 'Sync' }
        },
        {
          channelName: 'nr_allowedMethods',
          module: { name: '@koa/router', filePath: 'lib/router.js', versionRange: '>=13.0.0 <15.0.0' },
          functionQuery: { className: 'Router', methodName: 'allowedMethods', kind: 'Sync' }
        },
        {
          channelName: 'nr_allowedMethods',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'Router', methodName: 'allowedMethods', kind: 'Sync' }
        },
        {
          channelName: 'nr_allowedMethods',
          module: { name: '@koa/router', filePath: 'dist/index.js', versionRange: '>=15.0.0' },
          functionQuery: { className: 'RouterImplementation', methodName: 'allowedMethods', kind: 'Sync' }
        }
      ]
    }
  ],
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
    },
    {
      path: './koa/create-context.js',
      instrumentations: [
        {
          channelName: 'nr_createContext',
          module: {
            name: 'koa',
            filePath: 'lib/application.js',
            versionRange: '>=2.0.0'
          },
          functionQuery: {
            methodName: 'createContext',
            kind: 'Sync'
          }
        }
      ]
    }
  ]
}
