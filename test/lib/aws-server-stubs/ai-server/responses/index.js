/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const amazon = require('./amazon')
const claude = require('./claude')
const claude3 = require('./claude3')
const cohere = require('./cohere')
const converse = require('./converse')
const llama = require('./llama')

module.exports = {
  amazon,
  claude,
  claude3,
  cohere,
  converse,
  llama
}
