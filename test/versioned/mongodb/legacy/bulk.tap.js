/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('../collection-common')
const semver = require('semver')
const { pkgVersion, STATEMENT_PREFIX } = require('../common')

// see test/versioned/mongodb/common.js
if (semver.satisfies(pkgVersion, '>=3.2.4')) {
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
      verify(null, [`${STATEMENT_PREFIX}/unorderedBulk/batch`, 'Callback: done'], ['unorderedBulk'])
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
      verify(null, [`${STATEMENT_PREFIX}/orderedBulk/batch`, 'Callback: done'], ['orderedBulk'])
    })
  })
}
