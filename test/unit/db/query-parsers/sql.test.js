/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var parseSql = require('../../../../lib/db/query-parsers/sql')
var CATs = require('../../../lib/cross_agent_tests/sql_parsing')


describe('database query parser', function() {
  it("should accept query as a string", function() {
    var ps = parseSql("select * from someTable")
    ps.query.should.equal('select * from someTable')
  })

  it("should accept query as a sql property of an object", function() {
    var ps = parseSql({
      sql: "select * from someTable"
    })
    ps.query.should.equal('select * from someTable')
  })

  describe('SELECT SQL', function() {
    it("should parse a simple query", function() {
      var ps = parseSql("Select * from dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('select')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('Select * from dude')
    })

    it('should parse more interesting queries too', function() {
      var sql = [
        'SELECT P.postcode, ',
        'P.suburb, ',
        'R.region_state as state, ',
        'PR.region_id , ',
        'P.id ',
        'FROM postcodes as P ',
        'JOIN postcodes_regions as PR on PR.postcode = P.postcode ',
        'join ref_region as R on PR.region_id = R.region_id ',
        'join ref_state as S on S.state_id = R.region_state ',
        'WHERE S.state_code = ? ',
        'AND P.suburb_seo_key = ? ',
        'LIMIT 1'
      ].join('\n')
      var ps = parseSql(sql)
      expect(ps).to.exist
      expect(ps).to.have.property('operation', 'select')
      expect(ps).to.have.property('collection', 'postcodes')
      expect(ps).to.have.property('query', sql)
    })
  })

  describe('DELETE SQL', function() {
    it("should parse a simple command", function() {
      var ps = parseSql("DELETE\nfrom dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('DELETE\nfrom dude')
    })

    it("should parse a command with conditions", function() {
      var ps = parseSql("DELETE\nfrom dude where name = 'man'")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('DELETE\nfrom dude where name = \'man\'')
    })
  })

  describe('UPDATE SQL', function() {
    it("should parse a command with gratuitous white space and conditions", function() {
      var ps = parseSql("  update test set value = 1 where id = 12")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('update')

      should.exist(ps.collection)
      ps.collection.should.equal('test')
      ps.query.should.equal('update test set value = 1 where id = 12')
    })
  })

  describe('INSERT SQL', function() {
    it("should parse a command with a subquery", function() {
      var ps = parseSql("  insert into\ntest\nselect * from dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('insert')

      should.exist(ps.collection)
      ps.collection.should.equal('test')
      ps.query.should.equal('insert into\ntest\nselect * from dude')
    })
  })

  describe('invalid SQL', function() {
    it("should return 'other' when handed garbage", function() {
      var ps = parseSql("  bulge into\ndudes\nselect * from dude")
      should.exist(ps)
      ps.operation.should.equal('other')
      should.not.exist(ps.collection)
      ps.query.should.equal('bulge into\ndudes\nselect * from dude')
    })

    it("should return 'other' when handed an object", function() {
      var ps = parseSql({
        key: 'value'
      })
      should.exist(ps)
      ps.operation.should.equal('other')
      should.not.exist(ps.collection)
      expect(ps.query).equal('')
    })
  })

  describe('CAT', function() {
    CATs.forEach(function(cat) {
      describe(clean(cat.input), function() {
        var ps = parseSql(cat.input)

        it('should parse the operation as ' + cat.operation, function() {
          expect(ps).to.have.property('operation', cat.operation)
        })

        if (cat.table === '(subquery)') {
          it('should parse subquery collections as ' + cat.table)
        } else if (/\w+\.\w+/.test(ps.collection)) {
          it('should strip database names from collection names as ' + cat.table)
        } else {
          it('should parse the collection as ' + cat.table, function() {
            expect(ps).to.have.property('collection', cat.table)
          })
        }
      })
    })
  })
})

function clean(sql) {
  return '"' + sql
    .replace(/\n/gm, '\\n')
    .replace(/\r/gm, '\\r')
    .replace(/\t/gm, '\\t')
    + '"'
}
