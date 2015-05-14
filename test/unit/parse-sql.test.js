'use strict'

var chai     = require('chai')
  , should   = chai.should()
  , parseSql = require('../../lib/db/parse-sql')


describe('database query parser', function () {
  describe('SELECT SQL', function () {
    it("should parse a simple query", function () {
      var ps = parseSql('NoSQL', "Select * from dude")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('select')

      should.exist(ps.model)
      ps.model.should.equal('dude')
      ps.raw.should.equal('Select * from dude')
    })

    it("should parse another simple query", function () {
      var ps = parseSql('NoSQL', "Select * from transaction_traces_12")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('select')

      should.exist(ps.model)
      ps.model.should.equal('transaction_traces_12')
      ps.raw.should.equal('Select * from transaction_traces_12')
    })
  })

  describe('DELETE SQL', function () {
    it("should parse a simple command", function () {
      var ps = parseSql('NoSQL', "DELETE\nfrom dude")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.model)
      ps.model.should.equal('dude')
      ps.raw.should.equal('DELETE\nfrom dude')
    })

    it("should parse a command with conditions", function () {
      var ps = parseSql('NoSQL', "DELETE\nfrom dude where name = 'man'")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('delete')

      should.exist(ps.model)
      ps.model.should.equal('dude')
      ps.raw.should.equal('DELETE\nfrom dude where name = \'man\'')
    })
  })

  describe('UPDATE SQL', function () {
    it("should parse a command with gratuitous white space and conditions", function () {
      var ps = parseSql('NoSQL', "  update test set value = 1 where id = 12")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('update')

      should.exist(ps.model)
      ps.model.should.equal('test')
      ps.raw.should.equal('update test set value = 1 where id = 12')
    })
  })

  describe('INSERT SQL', function () {
    it("should parse a command with a subquery", function () {
      var ps = parseSql('NoSQL', "  insert into\ntest\nselect * from dude")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('insert')

      should.exist(ps.model)
      ps.model.should.equal('test')
      ps.raw.should.equal('insert into\ntest\nselect * from dude')
    })
  })

  describe('invalid SQL', function () {
    it("should return 'other' when handed garbage", function () {
      var ps = parseSql('NoSQL', "  bulge into\ndudes\nselect * from dude")
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('other')

      should.not.exist(ps.model)
      ps.raw.should.equal('bulge into\ndudes\nselect * from dude')
    })

    it("should return 'other' when handed an object", function () {
      var ps = parseSql('NoSQL', {
        key: 'value'
      })
      should.exist(ps)

      should.exist(ps.type)
      ps.type.should.equal('NoSQL')

      should.exist(ps.operation)
      ps.operation.should.equal('other')

      should.not.exist(ps.model)
      chai.expect(ps.raw).equal('')
    })
  })
})
