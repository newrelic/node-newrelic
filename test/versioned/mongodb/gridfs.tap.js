'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')

tap.test('agent instrumentation of MongoDB when GridFS is used', function(t) {
  t.plan(2)

  helper.bootstrapMongoDB([], function(err) {
    if (err) t.fail(err)

    var agent = helper.instrumentMockedAgent()
    helper.runInTransaction(agent, function() {
      var mongodb = require('mongodb')

      var host = 'mongodb://' + params.mongodb_host + ':' + params.mongodb_port + '/noexist'
      mongodb.connect(host, function(err, db) {
        if (err) t.fail(err)

        t.ok(db, 'got MongoDB connection')

        t.tearDown(function() {
          db.close()
        })

        var GridStore = mongodb.GridStore
        var gs = new GridStore(db, 'RandomFileName' + Math.random(), 'w')

        gs.open(function(err, gridfile) {
          if (err) t.fail(err)

          t.ok(gridfile, 'actually got file')
          t.end()
        })
      })
    })
  })
})
