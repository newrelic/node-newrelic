/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  rules: {
    'func-names': 'off',
    'max-nested-callbacks': 'off',
    'no-shadow': ['warn', { allow: ['t'] }]
  }
}
