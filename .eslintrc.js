/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  extends: ['@newrelic', 'plugin:jsdoc/recommended'],
  plugins: ['jsdoc'],
  rules: {
    'consistent-return': 'off',
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
          'EventEmitter'
        ]
      }
    ]
  },
  parserOptions: {
    ecmaVersion: 2022
  },
  ignorePatterns: [
    'test/versioned-external',
    'test/versioned/nextjs/app',
    'test/versioned/nextjs/app-dir'
  ],
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: {
        sourceType: 'module'
      },
      rules: {
        // TODO: remove this when we decide on how to address
        // here: https://issues.newrelic.com/browse/NEWRELIC-3321
        'node/no-unsupported-features/es-syntax': 'off'
      }
    },
    {
      files: ['newrelic.js'],
      rules: {
        'header/header': ['off']
      }
    },
    {
      files: ['./lib/shim/*.js', 'lib/transaction/handle.js', 'api.js'],
      rules: {
        'jsdoc/require-jsdoc': 'warn'
      }
    }
  ]
}
