/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('./agent_helper')

/**
 * Exports a replacement API for use with ES module importing `../index.js`.
 * Relies on a test agent being properly loaded prior to executing.
 */

// TODO: looks like modules won't ever get reload for us to re-apply instrumentation,
// so the always getting latest API is probably overkill here
const apiProxy = new Proxy(helper.getAgentApi(), {
  get: (target, key) => {
    // Always proxy to the latest reference of the API in the helper to
    // account for load/unload in test runs
    return helper.getAgentApi()[key]
  }
})

module.exports = apiProxy
