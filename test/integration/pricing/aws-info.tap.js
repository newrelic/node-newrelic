/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')


tap.test('pricing aws info', function(t) {
  require('./vendor-info-tests')(t, 'aws')
})
