/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  plugins: ['disable'],
  processor: 'disable/disable',
  settings: {
    'disable/plugins': ['jsdoc']
  },
  env: {
    mocha: true
  }
}
