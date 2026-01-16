/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const dc = require('node:diagnostics_channel')
const chan = dc.channel('baz.test')

module.exports = class Foo {
  baz() {
    chan.publish({ hello: 'world' })
  }
}
