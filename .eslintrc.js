/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  extends: '@newrelic',
  overrides: [
    {
      files: [
        'test/integration/*.tap.js',
        'test/integration/*/*.tap.js',
        'test/integration/core/exec-me.js'
      ],
      rules: {
        'no-console': ['off']
      }
    },
    {
      files: ['newrelic.js'],
      rules: {
        'header/header': ['off']
      }
    }
  ]
}
