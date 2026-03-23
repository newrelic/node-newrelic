/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const { testPromiseContext } = require('./common-tests')
const { beforeEach, afterEach } = require('./helpers')

test('Promise.noConflict', async function (t) {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.Promise = ctx.nr.Promise.noConflict()
  })

  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name)
    }
  })
})
