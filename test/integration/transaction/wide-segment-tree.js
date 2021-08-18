/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')

// node --v8-options | grep -B0 -A1 stack-size
// --stack-size (default size of stack region v8 is allowed to use (in kBytes))
// type: int  default: 984

// This is reliant on running in a node environment where stack
// size has been reduced to 1/3 the default. `--stack-size=328`
// Each pointer is 64bits, which means should start faulting at 41984.
const DANGEROUS_SEGMENT_WIDTH = 42000

const distributedTracingConfig = {
  distributed_tracing: {
    enabled: true
  },
  cross_application_tracer: { enabled: false },
  account_id: '1337',
  primary_application_id: '7331',
  trusted_account_key: '1337',
  encoding_key: 'some key'
}

// Trigger DT code paths on transaction end, as well
const agent = helper.loadMockedAgent(distributedTracingConfig)

helper.runInTransaction(agent, function (transaction) {
  const root = transaction.trace.root

  // Avoid special casing of root that can result in avoiding
  // bugs deeper in the tree with wide segment trees
  const child = root.add('child1')

  for (let index = 0; index < DANGEROUS_SEGMENT_WIDTH; index++) {
    child.add('segment: ' + index)
  }

  try {
    transaction.end()
  } finally {
    helper.unloadAgent(agent)
  }
})
