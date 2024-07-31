/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import { test } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { ESM } from './common.cjs'
const { STATEMENT_PREFIX } = ESM

const findOpt = { returnDocument: 'after' }

tap.test('Collection(Find) Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test({ suiteName: 'findOne', agent, t }, function findOneTest(t, collection, verify) {
    collection.findOne({ i: 15 }, function done(err, data) {
      t.error(err)
      t.equal(data.i, 15)
      verify(null, [`${STATEMENT_PREFIX}/findOne`, 'Callback: done'], ['findOne'])
    })
  })

  test(
    { suiteName: 'findOneAndDelete', agent, t },
    function findOneAndDeleteTest(t, collection, verify) {
      collection.findOneAndDelete({ i: 15 }, function done(err, data) {
        t.error(err)
        t.equal(data.ok, 1)
        t.equal(data.value.i, 15)
        verify(
          null,
          [`${STATEMENT_PREFIX}/findOneAndDelete`, 'Callback: done'],
          ['findOneAndDelete']
        )
      })
    }
  )

  test(
    { suiteName: 'findOneAndReplace', agent, t },
    function findAndReplaceTest(t, collection, verify) {
      collection.findOneAndReplace({ i: 15 }, { b: 15 }, findOpt, done)

      function done(err, data) {
        t.error(err)
        t.equal(data.value.b, 15)
        t.equal(data.ok, 1)
        verify(
          null,
          [`${STATEMENT_PREFIX}/findOneAndReplace`, 'Callback: done'],
          ['findOneAndReplace']
        )
      }
    }
  )

  test(
    { suiteName: 'findOneAndUpdate', agent, t },
    function findOneAndUpdateTest(t, collection, verify) {
      collection.findOneAndUpdate({ i: 15 }, { $set: { a: 15 } }, findOpt, done)

      function done(err, data) {
        t.error(err)
        t.equal(data.value.a, 15)
        t.equal(data.ok, 1)
        verify(
          null,
          [`${STATEMENT_PREFIX}/findOneAndUpdate`, 'Callback: done'],
          ['findOneAndUpdate']
        )
      }
    }
  )
})
