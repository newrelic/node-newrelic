/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Some tests in this file need to assert that we handle non-error rejections:
const test = require('node:test')
const semver = require('semver')
const { testPromiseContext } = require('./common-tests')
const { beforeEach, afterEach } = require('./helpers')
const { version: pkgVersion } = require('bluebird/package')

test('Promise.getNewLibraryCopy', { skip: semver.lt(pkgVersion, '3.4.1') }, async function (t) {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.Promise = ctx.nr.Promise.getNewLibraryCopy()
  })

  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name)
    }
  })
})
