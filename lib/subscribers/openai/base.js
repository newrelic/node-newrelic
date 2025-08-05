/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')

class OpenAISubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({ agent, logger, packageName: 'openai', channelName })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this.config.ai_monitoring?.enabled
  }
}

module.exports = OpenAISubscriber
