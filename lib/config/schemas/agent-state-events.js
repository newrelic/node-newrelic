/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'agent-state-events.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Specifies whether the agent reports its own lifecycle (connected, heartbeat, shutdown) to New Relic as NodeAgentState custom events, through the same license-key-authenticated connection used for Transaction and Error data.'
    }
  },
  additionalProperties: true,
  description: 'Specifies whether the agent reports its own lifecycle as NodeAgentState custom events.'
}
