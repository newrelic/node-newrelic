/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver'
import tap from 'tap'
import { test, DB_NAME } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { pkgVersion, STATEMENT_PREFIX, COLLECTIONS } from './common.cjs'

tap.test('Collection(Index) Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })
  test({ suiteName: 'createIndex', agent, t }, function createIndexTest(t, collection, verify) {
    collection.createIndex('i', function onIndex(err, data) {
      t.error(err)
      t.equal(data, 'i_1')
      verify(null, [`${STATEMENT_PREFIX}/createIndex`, 'Callback: onIndex'], ['createIndex'])
    })
  })

  test({ suiteName: 'dropIndex', agent, t }, function dropIndexTest(t, collection, verify) {
    collection.createIndex('i', function onIndex(err) {
      t.error(err)
      collection.dropIndex('i_1', function done(err, data) {
        t.error(err)
        t.equal(data.ok, 1)
        verify(
          null,
          [
            `${STATEMENT_PREFIX}/createIndex`,
            'Callback: onIndex',
            `${STATEMENT_PREFIX}/dropIndex`,
            'Callback: done'
          ],
          ['createIndex', 'dropIndex']
        )
      })
    })
  })

  test({ suiteName: 'indexes', agent, t }, function indexesTest(t, collection, verify) {
    collection.indexes(function done(err, data) {
      t.error(err)
      const result = data && data[0]
      const expectedResult = {
        v: result && result.v,
        key: { _id: 1 },
        name: '_id_'
      }

      // this will fail if running a mongodb server > 4.3.1
      // https://jira.mongodb.org/browse/SERVER-41696
      // we only connect to a server > 4.3.1 when using the mongodb
      // driver of 4.2.0+
      if (semver.satisfies(pkgVersion, '<4.2.0')) {
        expectedResult.ns = `${DB_NAME}.${COLLECTIONS.collection1}`
      }
      t.same(result, expectedResult, 'should have expected results')

      verify(null, [`${STATEMENT_PREFIX}/indexes`, 'Callback: done'], ['indexes'])
    })
  })

  test({ suiteName: 'indexExists', agent, t }, function indexExistsTest(t, collection, verify) {
    collection.indexExists(['_id_'], function done(err, data) {
      t.error(err)
      t.equal(data, true)

      verify(null, [`${STATEMENT_PREFIX}/indexExists`, 'Callback: done'], ['indexExists'])
    })
  })

  test(
    { suiteName: 'indexInformation', agent, t },
    function indexInformationTest(t, collection, verify) {
      collection.indexInformation(function done(err, data) {
        t.error(err)
        t.same(data && data._id_, [['_id', 1]], 'should have expected results')

        verify(
          null,
          [`${STATEMENT_PREFIX}/indexInformation`, 'Callback: done'],
          ['indexInformation']
        )
      })
    }
  )

  if (semver.satisfies(pkgVersion, '<4')) {
    test(
      { suiteName: 'dropAllIndexes', agent, t },
      function dropAllIndexesTest(t, collection, verify) {
        collection.dropAllIndexes(function done(err, data) {
          t.error(err)
          t.equal(data, true)
          verify(null, [`${STATEMENT_PREFIX}/dropAllIndexes`, 'Callback: done'], ['dropAllIndexes'])
        })
      }
    )

    test({ suiteName: 'ensureIndex', agent, t }, function ensureIndexTest(t, collection, verify) {
      collection.ensureIndex('i', function done(err, data) {
        t.error(err)
        t.equal(data, 'i_1')
        verify(null, [`${STATEMENT_PREFIX}/ensureIndex`, 'Callback: done'], ['ensureIndex'])
      })
    })

    test({ suiteName: 'reIndex', agent, t }, function reIndexTest(t, collection, verify) {
      collection.reIndex(function done(err, data) {
        t.error(err)
        t.equal(data, true)

        verify(null, [`${STATEMENT_PREFIX}/reIndex`, 'Callback: done'], ['reIndex'])
      })
    })
  }
})
