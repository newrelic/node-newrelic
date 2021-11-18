/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This fake module aids in testing './module' from multiple other modules.

const { foo } = require('./module')

module.exports = {
  foo,
  bar: 'baz'
}
