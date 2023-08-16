/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const runTests = require('./promises')

const usingLegacyContext = !!process.env.NEW_RELIC_FEATURE_FLAG_LEGACY_CONTEXT_MANAGER

test('Promises (await_support: false)', { skip: !usingLegacyContext }, (t) => {
  t.autoend()

  runTests(t, {
    await_support: false,
    legacy_context_manager: true
  })
})

test('Promises (await_support: true)', { skip: !usingLegacyContext }, (t) => {
  t.autoend()

  runTests(t, {
    await_support: true,
    legacy_context_manager: true
  })
})
