/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainCallbackManagerSubscriber = require('./tool-callback-manager')

class LangchainChainCallbackManagerSubscriber extends LangchainCallbackManagerSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_handleChainStart' })
  }
}

module.exports = LangchainChainCallbackManagerSubscriber
