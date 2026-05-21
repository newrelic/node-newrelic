/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { collectionTest } from './collection-common.mjs'
import common from '../mongodb/common.js'

const { STATEMENT_PREFIX } = common.ESM

collectionTest('unorderedBulkOp', async function unorderedBulkOpTest(collection, verify) {
  const bulk = collection.initializeUnorderedBulkOp()
  bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
  bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })

  await bulk.execute()
  verify(null, [`${STATEMENT_PREFIX}/unorderedBulk/batch`], ['unorderedBulk'], { strict: false })
})

collectionTest('orderedBulkOp', async function orderedBulkOpTest(collection, verify) {
  const bulk = collection.initializeOrderedBulkOp()
  bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
  bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })

  await bulk.execute()
  verify(null, [`${STATEMENT_PREFIX}/orderedBulk/batch`], ['orderedBulk'], { strict: false })
})
