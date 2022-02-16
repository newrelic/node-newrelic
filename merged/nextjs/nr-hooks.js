/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = [
  {
    type: 'web-framework',
    moduleName: './next-server',
    onRequire: require('./lib/next-server')
  },
  {
    type: 'web-framework',
    moduleName: './render',
    onRequire: require('./lib/render')
  },
  {
    type: 'web-framework',
    moduleName: './context',
    onRequire: require('./lib/context')
  }
]
