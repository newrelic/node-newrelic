/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const modName = 'kafkajs'

module.exports = {
  [modName]: [{
    path: './kafkajs/client-constructor.js',
    instrumentations: [{
      module: {
        name: modName,
        filePath: 'src/index.js',
        versionRange: '>=2.0.0'
      },
      channelName: 'nr_constructor',
      functionQuery: {
        className: 'Client'
      }
    }]
  }]
}
