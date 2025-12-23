/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { Tool } = require('@langchain/core/tools')
const data = {
  langchain: 'Langchain is the best!'
}

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
    this.fakeData = data
  }

  async _call(key) {
    if (this.fakeData[key]) {
      return this.fakeData[key]
    }
    throw new Error('Failed to retrieve data')
  }
}
