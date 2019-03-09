'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

// node --v8-options | grep -B0 -A1 stack-size
// --stack-size (default size of stack region v8 is allowed to use (in kBytes))
// type: int  default: 984

// Each pointer is 64bits. In theory, 125952 should be enough.
// 125000 is even working locally but rounding up for safety.
const DANGEROUS_SEGMENT_WIDTH = 126000

const distributedTracingConfig = {
  distributed_tracing: {
    enabled: true
  },
  cross_application_tracer: {enabled: false},
  account_id: '1337',
  primary_application_id: '7331',
  trusted_account_key: '1337',
  encoding_key: 'some key',
}

/**
 * NOTE: A sucessful run of this test is very long due to data processing.
 * Must be run with tap file timeout extended. For example --timeout=120
 */
test('should not exceed stack size for extremely wide segment trees', function(t) {
  // Trigger DT code paths on transaction end, as well
  const agent = helper.loadMockedAgent(distributedTracingConfig)
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, function(transaction) {
    const root = transaction.trace.root

    // Avoid special casing of root that can result in avoiding
    // bugs deeper in the tree with wide segment trees
    const child = root.add('child1')

    for (let index = 0; index < DANGEROUS_SEGMENT_WIDTH; index++) {
      child.add('segment: ' + index)
    }

    t.doesNotThrow(() => {
      transaction.end()
    })

    t.end()
  })
})

