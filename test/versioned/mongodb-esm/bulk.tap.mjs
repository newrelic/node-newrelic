/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import { test } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { ESM } from './common.cjs'
const { STATEMENT_PREFIX } = ESM

tap.test('Bulk operations', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test(
    { suiteName: 'unorderedBulkOp', agent, t },
    function unorderedBulkOpTest(t, collection, verify) {
      const bulk = collection.initializeUnorderedBulkOp()
      bulk
        .find({
          i: 1
        })
        .updateOne({
          $set: { foo: 'bar' }
        })
      bulk
        .find({
          i: 2
        })
        .updateOne({
          $set: { foo: 'bar' }
        })

      bulk.execute(function done(err) {
        t.error(err)
        verify(
          null,
          [`${STATEMENT_PREFIX}/unorderedBulk/batch`, 'Callback: done'],
          ['unorderedBulk']
        )
      })
    }
  )

  test(
    { suiteName: 'orderedBulkOp', agent, t },
    function unorderedBulkOpTest(t, collection, verify) {
      const bulk = collection.initializeOrderedBulkOp()
      bulk
        .find({
          i: 1
        })
        .updateOne({
          $set: { foo: 'bar' }
        })

      bulk
        .find({
          i: 2
        })
        .updateOne({
          $set: { foo: 'bar' }
        })

      bulk.execute(function done(err) {
        t.error(err)
        verify(null, [`${STATEMENT_PREFIX}/orderedBulk/batch`, 'Callback: done'], ['orderedBulk'])
      })
    }
  )
})
