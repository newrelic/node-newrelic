/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const runTests = require('./promises')

const usingAsyncLocal = process.env.NEW_RELIC_FEATURE_FLAG_ASYNC_LOCAL_CONTEXT

test('Promises (await_support: false)', { skip: usingAsyncLocal }, (t) => {
  t.autoend()

  runTests(t, {
    await_support: false,
    async_local_context: false
  })
})

test('Promises (await_support: true)', { skip: usingAsyncLocal }, (t) => {
  t.autoend()

  runTests(t, {
    await_support: true,
    async_local_context: false
  })
})
