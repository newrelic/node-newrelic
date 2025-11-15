/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import helper from '../../lib/agent_helper.js'
const agent = helper.instrumentMockedAgent({
  attributes: {
    enabled: true
  }
})
const params = {
  encoding_key: 'this is an encoding key',
  cross_process_id: '1234#4321'
}
agent.config._fromServer(params, 'encoding_key')
agent.config._fromServer(params, 'cross_process_id')
agent.config.trusted_account_ids = [1234]
export { agent }
