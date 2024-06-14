/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ai21 = require('./ai21')
const amazon = require('./amazon')
const claude = require('./claude')
const claude3 = require('./claude3')
const cohere = require('./cohere')
const llama2 = require('./llama2')

module.exports = {
  ai21,
  amazon,
  claude,
  claude3,
  cohere,
  llama2
}
