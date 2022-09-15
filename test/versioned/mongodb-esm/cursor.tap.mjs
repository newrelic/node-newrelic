/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import concat from 'concat-stream'
import semver from 'semver'
import tap from 'tap'
import {
  test,
  dropTestCollections,
  close,
  populate,
  connect,
  TRANSACTION_NAME
} from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { pkgVersion } from './common.cjs'

tap.test('Cursor Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test({ suiteName: 'count', agent, t }, function countTest(t, collection, verify) {
    collection.find({}).count(function onCount(err, data) {
      t.notOk(err, 'should not error')
      t.equal(data, 30, 'should have correct result')
      verify(
        null,
        ['Datastore/statement/MongoDB/esmTestCollection/count', 'Callback: onCount'],
        ['count']
      )
    })
  })

  test({ suiteName: 'explain', agent, t }, function explainTest(t, collection, verify) {
    collection.find({}).explain(function onExplain(err, data) {
      t.error(err)
      // Depending on the version of the mongo server the explain plan is different.
      if (data.hasOwnProperty('cursor')) {
        t.equal(data.cursor, 'BasicCursor', 'should have correct response')
      } else {
        t.ok(data.hasOwnProperty('queryPlanner'), 'should have correct response')
      }
      verify(
        null,
        ['Datastore/statement/MongoDB/esmTestCollection/explain', 'Callback: onExplain'],
        ['explain']
      )
    })
  })

  if (semver.satisfies(pkgVersion, '<3')) {
    test({ suiteName: 'nextObject', agent, t }, function nextObjectTest(t, collection, verify) {
      collection.find({}).nextObject(function onNextObject(err, data) {
        t.notOk(err)
        t.equal(data.i, 0)
        verify(
          null,
          ['Datastore/statement/MongoDB/esmTestCollection/nextObject', 'Callback: onNextObject'],
          ['nextObject']
        )
      })
    })
  }

  test({ suiteName: 'next', agent, t }, function nextTest(t, collection, verify) {
    collection.find({}).next(function onNext(err, data) {
      t.notOk(err)
      t.equal(data.i, 0)
      verify(
        null,
        ['Datastore/statement/MongoDB/esmTestCollection/next', 'Callback: onNext'],
        ['next']
      )
    })
  })

  test({ suiteName: 'toArray', agent, t }, function toArrayTest(t, collection, verify) {
    collection.find({}).toArray(function onToArray(err, data) {
      t.notOk(err)
      t.equal(data[0].i, 0)
      verify(
        null,
        ['Datastore/statement/MongoDB/esmTestCollection/toArray', 'Callback: onToArray'],
        ['toArray']
      )
    })
  })

  if (semver.satisfies(pkgVersion, '<4')) {
    t.test('piping cursor stream hides internal calls', function (t) {
      t.autoend()
      let client = null
      let db = null
      let collection = null

      t.before(async () => {
        const { default: mongodb } = await import('mongodb')
        return dropTestCollections(mongodb, ['esmTestCollection'])
          .then(() => {
            return connect(mongodb)
          })
          .then((res) => {
            client = res.client
            db = res.db

            collection = db.collection('esmTestCollection')
            return populate(db, collection)
          })
      })

      t.teardown(function () {
        agent.metrics.clear()
        return close(client, db)
      })

      t.test('stream test', (t) => {
        helper.runInTransaction(agent, function (transaction) {
          transaction.name = TRANSACTION_NAME
          const destination = concat(function () {})

          destination.on('finish', function () {
            transaction.end()
            t.equal(
              transaction.trace.root.children[0].name,
              'Datastore/operation/MongoDB/pipe',
              'should have pipe segment'
            )
            t.equal(
              0,
              transaction.trace.root.children[0].children.length,
              'pipe should not have any children'
            )
            t.end()
          })

          collection.find({}).pipe(destination)
        })
      })
    })
  }
})
