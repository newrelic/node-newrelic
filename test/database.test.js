var should = require('should')
  , logger = require('../lib/logger').getLogger()
  , db     = require('../lib/database')
  ;

describe('database query parser', function () {
  before(function (done) {
    logger.logToConsole(false);

    return done();
  });

  describe('SELECT DML', function () {
    it("should parse a simple query", function (done) {
      var ps = db.parseSql("Select * from dude");
      should.exist(ps);
      ps.operation.should.equal('select');
      ps.model.should.equal('dude');

      return done();
    });

    it("should parse another simple query", function (done) {
      var ps = db.parseSql("Select * from transaction_traces_12");
      should.exist(ps);
      ps.operation.should.equal('select');
      ps.model.should.equal('transaction_traces_12');

      return done();
    });
  });

  describe('DELETE DML', function () {
    it("should parse a simple command", function (done) {
      var ps = db.parseSql("DELETE\nfrom dude");
      should.exist(ps);
      ps.operation.should.equal('delete');
      ps.model.should.equal('dude');

      return done();
    });

    it("should parse a command with conditions", function (done) {
      var ps = db.parseSql("DELETE\nfrom dude where name = 'man'");
      should.exist(ps);
      ps.operation.should.equal('delete');
      ps.model.should.equal('dude');

      return done();
    });
  });

  describe('UPDATE DML', function () {
    it("should parse a command with gratuitous white space and conditions", function (done) {
      var ps = db.parseSql("  update test set value = 1 where id = 12");
      should.exist(ps);
      ps.operation.should.equal('update');
      ps.model.should.equal('test');

      return done();
    });
  });

  describe('INSERT DML', function () {
    it("should parse a command with a subquery", function (done) {
      var ps = db.parseSql("  insert into\ntest\nselect * from dude");
      should.exist(ps);
      ps.operation.should.equal('insert');
      ps.model.should.equal('test');

      return done();
    });
  });

  describe('invalid DML', function () {
    it("should return 'unknown' for operation and model when handed garbage", function (done) {
      var ps = db.parseSql("  bulge into\ndudes\nselect * from dude");
      should.exist(ps);
      ps.operation.should.equal('unknown');
      ps.model.should.equal('unknown');

      return done();
    });
  });
});
