/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = {
  dns: [
    {
      path: './dns/index', instrumentations: []
    },
    {
      path: './dns/promises', instrumentations: []
    }
  ]
}
