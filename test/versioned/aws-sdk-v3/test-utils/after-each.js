/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = afterEach

const helper = require('../../../lib/agent_helper')

/**
 * Common afterEach hook that unloads agent, stops server, and deletes
 * packages in require cache
 *
 * @param {object} ctx test context
 */
function afterEach(ctx) {
  ctx.nr.server.destroy()
  helper.unloadAgent(ctx.nr.agent)
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('@aws-sdk') || key.includes('@smithy')) {
      delete require.cache[key]
    }
  })
}
