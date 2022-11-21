/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  extends: ['@newrelic', 'plugin:jsdoc/recommended', 'plugin:sonarjs/recommended'],
  plugins: ['jsdoc', 'sonarjs'],
  rules: {
    'consistent-return': 'off',
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/no-undefined-types': [
      'warn',
      { definedTypes: ['Logger', 'Agent', 'Shim', 'TraceSegment'] }
    ]
  },
  parserOptions: {
    ecmaVersion: '2020'
  },
  parserOptions: {
    ecmaVersion: 2020
  },
  ignorePatterns: ['test/versioned-external'],
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022
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
    },
    {
      files: ['test/**/**/**', 'tests/**/**/**'],
      // TODO: remove these overrides as part of https://issues.newrelic.com/browse/NEWRELIC-5257
      rules: {
        'sonarjs/no-duplicate-string': 'off',
        'sonarjs/cognitive-complexity': 'off'
      }
    }
  ]
}
