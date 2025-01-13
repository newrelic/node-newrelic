/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../config/attribute-filter')

class BaseLlmEvent {
  // eslint-disable-next-line accessor-pairs
  set metadata(agent) {
    const transaction = agent.tracer.getTransaction()
    const attrs = transaction?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE) || {}
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('llm.')) {
        this[key] = value
      }
    }
  }
}

module.exports = BaseLlmEvent
