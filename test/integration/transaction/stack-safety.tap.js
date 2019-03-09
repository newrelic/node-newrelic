'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

// node --v8-options | grep -B0 -A1 stack-size
// --stack-size (default size of stack region v8 is allowed to use (in kBytes))
// type: int  default: 984

// Each pointer is 64bits. In theory, 125952 should be enough.
// 125000 is even working locally but rounding up for safety.
const DANGEROUS_SEGMENT_WIDTH = 126000

test('should not exceed stack size for extremely wide segment trees', function(t) {
  const agent = helper.loadMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, function(transaction) {
    const root = transaction.trace.root

    for (let index = 0; index < DANGEROUS_SEGMENT_WIDTH; index++) {
      root.add('segment: ' + index)
    }

    // We don't care about processing.
    // Ignore to avoid data creation and speed up passing test
    transaction.ignore = true

    t.doesNotThrow(() => {
      transaction.end()
    })

    t.end()
  })
})

