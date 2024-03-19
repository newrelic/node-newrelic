/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const { STATEMENT_PREFIX } = require('./common')

common.test('unorderedBulkOp', async function unorderedBulkOpTest(t, collection, verify) {
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

  await bulk.execute()
  verify(null, [`${STATEMENT_PREFIX}/unorderedBulk/batch`], ['unorderedBulk'], { strict: false })
})

common.test('orderedBulkOp', async function unorderedBulkOpTest(t, collection, verify) {
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

  await bulk.execute()
  verify(null, [`${STATEMENT_PREFIX}/orderedBulk/batch`], ['orderedBulk'], { strict: false })
})
