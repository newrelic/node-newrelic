/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports
const http = require('http')

utils.run = function run({ path = '/123', context }) {
  context.server = context.app.listen(0, function () {
    http
      .get({
        port: context.server.address().port,
        path
      })
      .end()
  })
}
