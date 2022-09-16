/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import semver from 'semver'
import { test } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { pkgVersion } from './common.cjs'

// see test/versioned/mongodb/common.js
if (semver.satisfies(pkgVersion, '>=3.2.4 <4.1.4')) {
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
            ['Datastore/statement/MongoDB/esmTestCollection/unorderedBulk/batch', 'Callback: done'],
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
          verify(
            null,
            ['Datastore/statement/MongoDB/esmTestCollection/orderedBulk/batch', 'Callback: done'],
            ['orderedBulk']
          )
        })
      }
    )
  })
}
