/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createSubscriptionConfig = require('./create-config')
const subscribers = {}
const config = createSubscriptionConfig()

module.exports = {
  subscribers,
  config
}
