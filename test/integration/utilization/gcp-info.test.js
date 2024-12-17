/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const vendorTests = require('./vendor-info-tests')

test('pricing gcp info', async function (t) {
  await vendorTests(t, 'gcp')
})
