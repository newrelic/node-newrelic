/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const dc = require('node:diagnostics_channel')
const chan = dc.channel('bar.test')

module.exports = class Bar {
  bar() {
    chan.publish({ hello: 'world' })
  }
}
