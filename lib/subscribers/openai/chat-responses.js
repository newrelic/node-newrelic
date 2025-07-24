/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const OpenAIChatCompletions = require('./chat')

class OpenAIResponses extends OpenAIChatCompletions {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_responses' })
  }
}

module.exports = OpenAIResponses
