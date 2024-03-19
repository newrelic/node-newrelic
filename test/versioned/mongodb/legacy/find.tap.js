/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = require('../collection-common')
const { STATEMENT_PREFIX } = require('../common')

const findOpt = { returnOriginal: false }

common.test('findAndModify', function findAndModifyTest(t, collection, verify) {
  collection.findAndModify({ i: 1 }, [['i', 1]], { $set: { a: 15 } }, { new: true }, done)

  function done(err, data) {
    t.error(err)
    t.equal(data.value.a, 15)
    t.equal(data.value.i, 1)
    t.equal(data.ok, 1)
    verify(null, [`${STATEMENT_PREFIX}/findAndModify`, 'Callback: done'], ['findAndModify'])
  }
})

common.test('findAndRemove', function findAndRemoveTest(t, collection, verify) {
  collection.findAndRemove({ i: 1 }, [['i', 1]], function done(err, data) {
    t.error(err)
    t.equal(data.value.i, 1)
    t.equal(data.ok, 1)
    verify(null, [`${STATEMENT_PREFIX}/findAndRemove`, 'Callback: done'], ['findAndRemove'])
  })
})

common.test('findOne', function findOneTest(t, collection, verify) {
  collection.findOne({ i: 15 }, function done(err, data) {
    t.error(err)
    t.equal(data.i, 15)
    verify(null, [`${STATEMENT_PREFIX}/findOne`, 'Callback: done'], ['findOne'])
  })
})

common.test('findOneAndDelete', function findOneAndDeleteTest(t, collection, verify) {
  collection.findOneAndDelete({ i: 15 }, function done(err, data) {
    t.error(err)
    t.equal(data.ok, 1)
    t.equal(data.value.i, 15)
    verify(null, [`${STATEMENT_PREFIX}/findOneAndDelete`, 'Callback: done'], ['findOneAndDelete'])
  })
})

common.test('findOneAndReplace', function findAndReplaceTest(t, collection, verify) {
  collection.findOneAndReplace({ i: 15 }, { b: 15 }, findOpt, done)

  function done(err, data) {
    t.error(err)
    t.equal(data.value.b, 15)
    t.equal(data.ok, 1)
    verify(null, [`${STATEMENT_PREFIX}/findOneAndReplace`, 'Callback: done'], ['findOneAndReplace'])
  }
})

common.test('findOneAndUpdate', function findOneAndUpdateTest(t, collection, verify) {
  collection.findOneAndUpdate({ i: 15 }, { $set: { a: 15 } }, findOpt, done)

  function done(err, data) {
    t.error(err)
    t.equal(data.value.a, 15)
    t.equal(data.ok, 1)
    verify(null, [`${STATEMENT_PREFIX}/findOneAndUpdate`, 'Callback: done'], ['findOneAndUpdate'])
  }
})
