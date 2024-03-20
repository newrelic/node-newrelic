/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('../collection-common')
const concat = require('concat-stream')
const helper = require('../../../lib/agent_helper')
const semver = require('semver')
const tap = require('tap')
const { pkgVersion, STATEMENT_PREFIX, COLLECTIONS } = require('../common')

common.test('count', function countTest(t, collection, verify) {
  collection.find({}).count(function onCount(err, data) {
    t.notOk(err, 'should not error')
    t.equal(data, 30, 'should have correct result')
    verify(null, [`${STATEMENT_PREFIX}/count`, 'Callback: onCount'], ['count'])
  })
})

common.test('explain', function explainTest(t, collection, verify) {
  collection.find({}).explain(function onExplain(err, data) {
    t.error(err)
    // Depending on the version of the mongo server the explain plan is different.
    if (data.hasOwnProperty('cursor')) {
      t.equal(data.cursor, 'BasicCursor', 'should have correct response')
    } else {
      t.ok(data.hasOwnProperty('queryPlanner'), 'should have correct response')
    }
    verify(null, [`${STATEMENT_PREFIX}/explain`, 'Callback: onExplain'], ['explain'])
  })
})

if (semver.satisfies(pkgVersion, '<3')) {
  common.test('nextObject', function nextObjectTest(t, collection, verify) {
    collection.find({}).nextObject(function onNextObject(err, data) {
      t.notOk(err)
      t.equal(data.i, 0)
      verify(null, [`${STATEMENT_PREFIX}/nextObject`, 'Callback: onNextObject'], ['nextObject'])
    })
  })
}

common.test('next', function nextTest(t, collection, verify) {
  collection.find({}).next(function onNext(err, data) {
    t.notOk(err)
    t.equal(data.i, 0)
    verify(null, [`${STATEMENT_PREFIX}/next`, 'Callback: onNext'], ['next'])
  })
})

common.test('toArray', function toArrayTest(t, collection, verify) {
  collection.find({}).toArray(function onToArray(err, data) {
    t.notOk(err)
    t.equal(data[0].i, 0)
    verify(null, [`${STATEMENT_PREFIX}/toArray`, 'Callback: onToArray'], ['toArray'])
  })
})

tap.test('piping cursor stream hides internal calls', function (t) {
  let agent = helper.instrumentMockedAgent()
  let client = null
  let db = null
  let collection = null

  t.teardown(async function () {
    await common.close(client, db)
    helper.unloadAgent(agent)
    agent = null
  })

  const mongodb = require('mongodb')
  common
    .dropTestCollections(mongodb)
    .then(() => {
      return common.connect(mongodb)
    })
    .then((res) => {
      client = res.client
      db = res.db

      collection = db.collection(COLLECTIONS.collection1)
      return common.populate(collection)
    })
    .then(runTest)

  function runTest() {
    helper.runInTransaction(agent, function (transaction) {
      transaction.name = common.TRANSACTION_NAME
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
  }
})
