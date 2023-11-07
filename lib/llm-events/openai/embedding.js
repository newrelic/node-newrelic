/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmEmbedding extends LlmEvent {
  constructor(agent, request = {}, response = {}) {
    super({ agent, request, response, responseAttrs: true })
    this.input = request.input?.toString()
  }
}
