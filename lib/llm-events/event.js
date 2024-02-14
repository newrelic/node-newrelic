/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../config/attribute-filter')
const CONVERSATION_ID = 'llm.conversation_id'

class BaseLlmEvent {
  getCustomAttributes(agent) {
    const transaction = agent.tracer.getTransaction()
    return transaction?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE) || {}
  }

  conversationId(agent) {
    return this.getCustomAttributes(agent)?.[CONVERSATION_ID]
  }

  set metadata(agent) {
    const attrs = this.getCustomAttributes(agent)
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('llm.') && key !== CONVERSATION_ID) {
        this[key] = value
      }
    }
  }
}

module.exports = BaseLlmEvent
