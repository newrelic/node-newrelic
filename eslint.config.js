/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const jsdoc = require('eslint-plugin-jsdoc')
const sharedConfig = require('@newrelic/eslint-config')

// The new eslint configuration format is a simple array of configuration
// objects. See https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects.
//
// While working on the config, it can be helpful to run:
//  npx @eslint/config-inspector

// This should be used to override rules we don't need applied to our
// test suites.
const testFiles = [
  'test/benchmark/**',
  'test/integration/**',
  'test/unit/**',
  'test/smoke/**',
  'test/versioned/**',
  'bin/test/**'
]

// See https://eslint.org/docs/latest/use/configure/ignore#ignoring-files
const globalIgnores = {
  ignores: [
    '**/node_modules/**',
    'docs/',
    'out/', // Compiled jsdocs directory.
    'test/versioned-external',
    'test/versioned/nextjs/app',
    'test/versioned/nextjs/app-dir'
  ]
}

const newrelicConfigOverrides = {
  files: ['**/newrelic.js', '**/newrelic.mjs'],
  rules: {
    'header/header': 'off'
  }
}

const jsdocConfig = {
  settings: {
    jsdoc: {
      // This is explicity set, so we don't get TypeScript-specific linting errors.
      mode: 'jsdoc'
    }
  },
  plugins: { jsdoc },
  rules: {
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/tag-lines': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/no-undefined-types': [
      'warn',
      {
        definedTypes: [
          'Logger',
          'Agent',
          'Shim',
          'MessageShim',
          'TraceSegment',
          'Transaction',
          'Tracer',
          'Exception',
          'MetricAggregator',
          'EventEmitter',
          'Context'
        ]
      }
    ],
    'jsdoc/valid-types': 'error',
    'jsdoc/check-param-names': 'error'
  }
}
const jsdocOverrides = {
  files: [
    './lib/shim/*.js',
    'lib/transaction/handle.js',
    'api.js'
  ],
  rules: {
    'jsdoc/require-jsdoc': 'warn'
  }
}

// Configuration objects are merged in order. That is, the last object in the
// list will merge with objects earlier in the list. This allows for overriding
// any settings by adding objects to the end of the list.
// See:
// + https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objectsar
// + https://eslint.org/blog/2022/08/new-config-system-part-2/#goodbye-extends%2C-hello-flat-cascade
module.exports = [
  ...sharedConfig.configs.neostandard,

  sharedConfig.plugins.sonarjs.configs.recommended,
  {
    ...sharedConfig.configs.sonarjsTestsOverrides,
    files: testFiles
  },
  sharedConfig.configs.sonarjsBaselineOverrides,

  jsdoc.configs['flat/recommended'],
  jsdocConfig,
  jsdocOverrides,

  {
    ...sharedConfig.configs.nodeRecommended,
    ignores: testFiles
  },
  {
    files: ['bin/*.js'],
    rules: { 'n/hashbang': 'off' }
  },

  sharedConfig.configs.baselineNewRelicConfig,
  newrelicConfigOverrides,
  globalIgnores
]
