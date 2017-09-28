'use strict'

var chai     = require('chai')
  , should   = chai.should()
  , expect   = chai.expect
  , parseSql = require('../../../../lib/db/query-parsers/sql')


describe('database query parser', function () {

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

  describe('SELECT SQL', function () {
    it("should parse a simple query", function () {
      var ps = parseSql("Select * from dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('select')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('Select * from dude')
    })
  })

  describe('DELETE SQL', function () {
    it("should parse a simple command", function () {
      var ps = parseSql("DELETE\nfrom dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('DELETE\nfrom dude')
    })

    it("should parse a command with conditions", function () {
      var ps = parseSql("DELETE\nfrom dude where name = 'man'")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.collection)
      ps.collection.should.equal('dude')
      ps.query.should.equal('DELETE\nfrom dude where name = \'man\'')
    })
  })

  describe('UPDATE SQL', function () {
    it("should parse a command with gratuitous white space and conditions", function () {
      var ps = parseSql("  update test set value = 1 where id = 12")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('update')

      should.exist(ps.collection)
      ps.collection.should.equal('test')
      ps.query.should.equal('update test set value = 1 where id = 12')
    })
  })

  describe('INSERT SQL', function () {
    it("should parse a command with a subquery", function () {
      var ps = parseSql("  insert into\ntest\nselect * from dude")
      should.exist(ps)

      should.exist(ps.operation)
      ps.operation.should.equal('insert')

      should.exist(ps.collection)
      ps.collection.should.equal('test')
      ps.query.should.equal('insert into\ntest\nselect * from dude')
    })
  })

  describe('invalid SQL', function () {
    it("should return 'other' when handed garbage", function () {
      var ps = parseSql("  bulge into\ndudes\nselect * from dude")
      should.exist(ps)
      ps.operation.should.equal('other')
      should.not.exist(ps.collection)
      ps.query.should.equal('bulge into\ndudes\nselect * from dude')
    })

    it("should return 'other' when handed an object", function () {
      var ps = parseSql({
        key: 'value'
      })
      should.exist(ps)
      ps.operation.should.equal('other')
      should.not.exist(ps.collection)
      expect(ps.query).equal('')
    })
  })
})
