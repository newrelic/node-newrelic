'use strict';

var path   = require('path')
  , fs     = require('fs')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("built-in fs module instrumentation should trace the reading of directories",
     function (t) {
  t.plan(8);

  var agent = helper.instrumentMockedAgent();

  var TESTDIR = 'XXXSHOULDNOTEXISTXXX'
    , FILE1   = 'IMAFILE'
    , FILE2   = 'IMANOTHERFILE'
    , FILE3   = 'IMLINK'
    ;

  fs.mkdir(TESTDIR, function (error) {
    if (error) return t.fail(error);

    [FILE1, FILE2, FILE3].forEach(function (filename) {
      fs.writeFileSync(path.join(TESTDIR, filename), 'I like clams', 'utf8');
    });

    t.notOk(agent.getTransaction(), "transaction isn't yet created");

    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), "transaction is now in context");
      fs.readdir(TESTDIR, function (error, files) {
        if (error) return t.fail(error);

        t.ok(agent.getTransaction(), "transaction is still in context in callback");

        t.equals(files.length, 3, "all the files show up");
        [FILE1, FILE2, FILE3].forEach(function (filename) {
          t.notEquals(files.indexOf(filename), -1, "only the files show up");
        });

        var stats = agent
          .getTransaction()
          .metrics
          .getOrCreateMetric('Filesystem/ReadDir/' + TESTDIR)
          .stats;
        t.equals(stats.callCount, 1, "instrumentation should know method was called");

        var transaction = agent.getTransaction();
        transaction.end();
        helper.unloadAgent(agent);

        [FILE1, FILE2, FILE3].forEach(function (filename) {
          fs.unlinkSync(path.join(TESTDIR, filename));
        });

        fs.rmdir(TESTDIR, function (error) {
          if (error) return t.fail(error);

          return t.end();
        });
      });
    });
  });
});
