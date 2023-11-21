/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmEmbedding extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false }) {
    super({ agent, segment, request, response, responseAttrs: true })
    this.error = withError
    this.input = request.input?.toString()
  }
}
