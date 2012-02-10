var db = require('../lib/database');
var winston = require('winston');

var logger = new (winston.Logger)({
        transports: [ new (winston.transports.Console)()]
      });

exports['test select'] = function(beforeExit, assert) {
    var ps = db.parseSql("Select * from dude");
    assert.isNotNull(ps);
    assert.equal('select', ps.operation);
    assert.equal('dude', ps.model);
};

exports['test select2'] = function(beforeExit, assert) {
    var ps = db.parseSql("Select * from transaction_traces_12");
    assert.isNotNull(ps);
    assert.equal('select', ps.operation);
    assert.equal('transaction_traces_12', ps.model);
};

exports['test delete'] = function(beforeExit, assert) {
    var ps = db.parseSql("DELETE\nfrom dude");
    assert.isNotNull(ps);
    assert.equal('delete', ps.operation);
    assert.equal('dude', ps.model);
};

exports['test delete2'] = function(beforeExit, assert) {
    var ps = db.parseSql("DELETE\nfrom dude where name = 'man'");
    assert.isNotNull(ps);
    assert.equal('delete', ps.operation);
    assert.equal('dude', ps.model);
};


exports['test update'] = function(beforeExit, assert) {
    var ps = db.parseSql("  update test set value = 1 where id = 12");
    assert.isNotNull(ps);
    assert.equal('update', ps.operation);
    assert.equal('test', ps.model);
};

exports['test insert'] = function(beforeExit, assert) {
    var ps = db.parseSql("  insert into\ntest\nselect * from dude");
    assert.isNotNull(ps);
    assert.equal('insert', ps.operation);
    assert.equal('test', ps.model);
};

exports['test bad'] = function(beforeExit, assert) {
    var ps = db.parseSql("  bulge into\ndudes\nselect * from dude");
    assert.isNotNull(ps);
    assert.equal('unknown', ps.operation);
    assert.equal('unknown', ps.model);
};

