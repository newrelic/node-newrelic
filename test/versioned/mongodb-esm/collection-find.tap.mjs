/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver'
import tap from 'tap'
import { test } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { pkgVersion, STATEMENT_PREFIX } from './common.cjs'

let findOpt = { returnOriginal: false }
// 4.0.0 changed this opt https://github.com/mongodb/node-mongodb-native/pull/2803/files
if (semver.satisfies(pkgVersion, '>=4')) {
  findOpt = { returnDocument: 'after' }
}

tap.test('Collection(Find) Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  if (semver.satisfies(pkgVersion, '<4')) {
    test(
      { suiteName: 'findAndModify', agent, t },
      function findAndModifyTest(t, collection, verify) {
        collection.findAndModify({ i: 1 }, [['i', 1]], { $set: { a: 15 } }, { new: true }, done)

        function done(err, data) {
          t.error(err)
          t.equal(data.value.a, 15)
          t.equal(data.value.i, 1)
          t.equal(data.ok, 1)
          verify(null, [`${STATEMENT_PREFIX}/findAndModify`, 'Callback: done'], ['findAndModify'])
        }
      }
    )

    test(
      { suiteName: 'findAndRemove', agent, t },
      function findAndRemoveTest(t, collection, verify) {
        collection.findAndRemove({ i: 1 }, [['i', 1]], function done(err, data) {
          t.error(err)
          t.equal(data.value.i, 1)
          t.equal(data.ok, 1)
          verify(null, [`${STATEMENT_PREFIX}/findAndRemove`, 'Callback: done'], ['findAndRemove'])
        })
      }
    )
  }

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
