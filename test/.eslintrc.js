/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  plugins: ['disable'],
  processor: 'disable/disable',
  parserOptions: {
    ecmaVersion: '2020'
  },
  settings: {
    'disable/plugins': ['jsdoc']
  },
  env: {
    mocha: true
  },
  overrides: [
    {
      files: ['*.mjs'],
      rules: {
        'node/no-unsupported-features/es-syntax': 'off',
        'node/no-unpublished-import': 'off',
        'node/no-extraneous-import': 'off'
      }
    }
  ]
}
