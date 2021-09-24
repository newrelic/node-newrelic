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
    'no-console': 'off',
    'node/no-extraneous-require': 'off',
    'node/no-missing-require': 'off'
  }
}
