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
    'jsdoc/require-jsdoc': 'off'
  },
  ignorePatterns: ['test/versioned-external'],
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: {
        ecmaVersion: '2020'
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
