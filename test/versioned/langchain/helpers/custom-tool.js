/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { Tool } = require('@langchain/core/tools')
const { makeGetRequestAsync } = require('../../../lib/agent_helper')

module.exports = class TestTool extends Tool {
  static lc_name() {
    return 'TestTool'
  }

  name = 'node-agent-test-tool'
  description = 'A test tool for versioned tests'
  key

  constructor(params) {
    super()
    this.baseUrl = params.baseUrl ?? this.baseUrl
  }

  async _call(uri) {
    const url = `${this.baseUrl}/${uri}`
    const res = await makeGetRequestAsync(url)
    if (res.statusCode !== 200) {
      throw new Error('Failed to make request')
    }

    return res.body[this.key] || res.body
  }
}
