'use strict';

var path   = require('path')
  , fs     = require('fs')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  ;

test("built-in fs module instrumentation should trace the reading of directories",
     function (t) {
  t.plan(8);

  var agent = helper.loadMockedAgent();
  shimmer.bootstrapInstrumentation(agent);

  var TESTDIR = 'XXXSHOULDNOTEXISTXXX'
    , FILE1   = 'IMAFILE'
    , FILE2   = 'IMANOTHERFILE'
    , FILE3   = 'IMLINK'
    ;

  fs.mkdir(TESTDIR, function (error) {
    if (error) return t.fail(error);

    [FILE1, FILE2, FILE3].forEach(function (filename) {
      var written = fs.writeFileSync(path.join(TESTDIR, filename), 'I like clams', 'utf8');
    });

    t.notOk(agent.getTransaction());

    var wrapped = agent.tracer.transactionProxy(function () {
      t.ok(agent.getTransaction());
      fs.readdir(TESTDIR, function (error, files) {
        if (error) return t.fail(error);

        t.ok(agent.getTransaction());

        t.equals(files.length, 3, "all the files show up");
        [FILE1, FILE2, FILE3].forEach(function (filename) {
          t.notEquals(files.indexOf(filename), -1, "only the files show up");
        });

        var stats = agent
          .getTransaction()
          .metrics
          .getOrCreateMetric('Filesystem/ReadDir/' + TESTDIR, 'FIXME')
          .stats;
        t.equals(stats.callCount, 1, "instrumentation should know method was called");

        agent.getTransaction().end();
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
    wrapped();
  });
});
