/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

if (!global.Promise) {
  console.error('Promise tests cant run without native Promises')
  return
}

require('./promises')({await_support: false})
