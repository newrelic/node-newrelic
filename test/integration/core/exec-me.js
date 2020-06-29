#!/usr/bin/env node

/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

console.log('I am stdout')
console.error('I am stderr')

if (process.send) {
  process.send('hello')
}
