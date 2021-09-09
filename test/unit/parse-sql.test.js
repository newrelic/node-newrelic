/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const parseSql = require('../../lib/db/parse-sql')

tap.test('database query parser', function (t) {
  t.autoend()

  t.test('SELECT SQL', function (t) {
    t.autoend()

    t.test('should parse a simple query', function (t) {
      const ps = parseSql('NoSQL', 'Select\n *\n from dude')
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.ok(ps.operation)
      t.equal(ps.operation, 'select')
      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.raw, 'Select\n *\n from dude')
      t.end()
    })

    t.test('should parse another simple query', function (t) {
      const ps = parseSql('NoSQL', 'Select * from transaction_traces_12')
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.ok(ps.operation)
      t.equal(ps.operation, 'select')
      t.ok(ps.collection)
      t.equal(ps.collection, 'transaction_traces_12')
      t.equal(ps.raw, 'Select * from transaction_traces_12')
      t.end()
    })
  })

  t.test('DELETE SQL', function (t) {
    t.autoend()

    t.test('should parse a simple command', function (t) {
      const ps = parseSql('NoSQL', 'DELETE\nfrom dude')
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.ok(ps.operation)
      t.equal(ps.operation, 'delete')
      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.raw, 'DELETE\nfrom dude')
      t.end()
    })

    t.test('should parse a command with conditions', function (t) {
      const ps = parseSql('NoSQL', "DELETE\nfrom dude where name = 'man'")
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.ok(ps.operation)
      t.equal(ps.operation, 'delete')
      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.raw, "DELETE\nfrom dude where name = 'man'")
      t.end()
    })
  })

  t.test('UPDATE SQL', function (t) {
    t.autoend()

    t.test('should parse a command with gratuitous white space and conditions', function (t) {
      const ps = parseSql('NoSQL', '  update test set value = 1 where id = 12')
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.not(ps.operation, undefined)
      t.equal(ps.operation, 'update')
      t.not(ps.collection, undefined)
      t.equal(ps.collection, 'test')
      t.equal(ps.raw, 'update test set value = 1 where id = 12')
      t.end()
    })
  })

  t.test('INSERT SQL', function (t) {
    t.autoend()

    t.test('should parse a command with a subquery', function (t) {
      const ps = parseSql('NoSQL', '  insert into\ntest\nselect * from dude')
      t.ok(ps)
      t.not(ps.type, undefined)
      t.equal(ps.type, 'NoSQL')
      t.not(ps.operation, undefined)
      t.equal(ps.operation, 'insert')
      t.ok(ps.collection)
      t.equal(ps.collection, 'test')
      t.equal(ps.raw, 'insert into\ntest\nselect * from dude')
      t.end()
    })
  })

  t.test('invalid SQL', function (t) {
    t.autoend()

    t.test("should return 'other' when handed garbage", function (t) {
      const ps = parseSql('NoSQL', '  gender into\ndudes\nselect * from dude')
      t.ok(ps)
      t.not(ps.type, undefined)
      t.equal(ps.type, 'NoSQL')
      t.not(ps.operation, undefined)
      t.equal(ps.operation, 'other')
      t.equal(ps.collection, null)
      t.equal(ps.raw, 'gender into\ndudes\nselect * from dude')
      t.end()
    })

    t.test("should return 'other' when handed an object", function (t) {
      const ps = parseSql('NoSQL', { key: 'value' })
      t.ok(ps)
      t.ok(ps.type)
      t.equal(ps.type, 'NoSQL')
      t.ok(ps.operation)
      t.equal(ps.operation, 'other')
      t.equal(ps.collection, null)
      t.equal(ps.raw, '')
      t.end()
    })
  })
})
