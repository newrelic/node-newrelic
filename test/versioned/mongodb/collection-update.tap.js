/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var common = require('./collection-common')


common.test('deleteMany', function deleteManyTest(t, collection, verify) {
  collection.deleteMany({mod10: 5}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 3})
    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/deleteMany',
        'Callback: done'
      ],
      ['deleteMany']
    )
  })
})

common.test('deleteOne', function deleteOneTest(t, collection, verify) {
  collection.deleteOne({mod10: 5}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 1})
    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/deleteOne',
        'Callback: done'
      ],
      ['deleteOne']
    )
  })
})

common.test('insert', function insertTest(t, collection, verify) {
  collection.insert({foo: 'bar'}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/insert',
        'Callback: done'
      ],
      ['insert']
    )
  })
})

common.test('insertMany', function insertManyTest(t, collection, verify) {
  collection.insertMany([{foo: 'bar'}, {foo: 'bar2'}], function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 2})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/insertMany',
        'Callback: done'
      ],
      ['insertMany']
    )
  })
})

common.test('insertOne', function insertOneTest(t, collection, verify) {
  collection.insertOne({foo: 'bar'}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/insertOne',
        'Callback: done'
      ],
      ['insertOne']
    )
  })
})

common.test('remove', function removeTest(t, collection, verify) {
  collection.remove({mod10: 5}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 3})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/remove',
        'Callback: done'
      ],
      ['remove']
    )
  })
})

common.test('replaceOne', function replaceOneTest(t, collection, verify) {
  collection.replaceOne({i: 5}, {foo: 'bar'}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/replaceOne',
        'Callback: done'
      ],
      ['replaceOne']
    )
  })
})

common.test('save', function saveTest(t, collection, verify) {
  collection.save({foo: 'bar'}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/save',
        'Callback: done'
      ],
      ['save']
    )
  })
})

common.test('update', function updateTest(t, collection, verify) {
  collection.update({i: 5}, {foo: 'bar'}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/update',
        'Callback: done'
      ],
      ['update']
    )
  })
})

common.test('updateMany', function updateManyTest(t, collection, verify) {
  collection.updateMany({mod10: 5}, {$set: {a: 5}}, function done(err, data) {
    t.error(err)
    t.deepEqual(data.result, {ok: 1, nModified: 3, n: 3})

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/updateMany',
        'Callback: done'
      ],
      ['updateMany']
    )
  })
})

common.test('updateOne', function updateOneTest(t, collection, verify) {
  collection.updateOne({i: 5}, {$set: {a: 5}}, function done(err, data) {
    t.notOk(err, 'should not error')
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1}, 'should have correct results')

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/updateOne',
        'Callback: done'
      ],
      ['updateOne']
    )
  })
})
