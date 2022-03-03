/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const mongoPackage = require('mongodb/package.json')
const semver = require('semver')

// see test/versioned/mongodb/common.js
if (semver.satisfies(mongoPackage.version, '>=3 <4.2.0')) {
  common.test('unorderedBulkOp', function unorderedBulkOpTest(t, collection, verify) {
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
        ['Datastore/statement/MongoDB/testCollection/unorderedBulk/batch', 'Callback: done'],
        ['unorderedBulk']
      )
    })
  })

  common.test('orderedBulkOp', function unorderedBulkOpTest(t, collection, verify) {
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
        ['Datastore/statement/MongoDB/testCollection/orderedBulk/batch', 'Callback: done'],
        ['orderedBulk']
      )
    })
  })
}
