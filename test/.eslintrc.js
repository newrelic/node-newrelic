/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  extends: ['plugin:jsdoc/recommended'],
  plugins: ['jsdoc', 'disable'],
  processor: 'disable/disable',
  env: {
    mocha: true
  },
  overrides: [
    {
      files: ['./**/*.js'],
      settings: {
        'disable/plugins': ['jsdoc']
      }
    }
  ]
}
