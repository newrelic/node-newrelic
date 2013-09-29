'use strict';

var path         = require('path')
  , EventEmitter = require('events').EventEmitter
  , tap          = require('tap')
  , test         = tap.test
  , helper       = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("asynchronous state propagation", function (t) {
  t.plan(12);

  t.test("a. async transaction with setTimeout",
       {timeout : 5000},
       function (t) {
    t.plan(2);

    var agent = helper.loadMockedAgent();

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler() {
      t.ok(agent.getTransaction(), "transaction should be visible");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () { setTimeout(handler, 100); });
  });

  t.test("b. async transaction with setInterval",
       {timeout : 5000},
       function (t) {
    t.plan(4);

    var count = 0
      , agent = helper.loadMockedAgent()
      , handle
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler() {
      count += 1;
      if (count > 2) clearInterval(handle);
      t.ok(agent.getTransaction(), "transaction should be visible");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () { handle = setInterval(handler, 50); });
  });

  t.test("c. async transaction with process.nextTick",
       {timeout : 5000},
       function (t) {
    t.plan(2);

    var agent = helper.loadMockedAgent();

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler() {
      t.ok(agent.getTransaction(), "transaction should be visible");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () { process.nextTick(handler); });
  });

  t.test("d. async transaction with EventEmitter.prototype.emit",
       {timeout : 5000},
       function (t) {
    t.plan(2);

    var agent = helper.loadMockedAgent()
      , ee    = new EventEmitter()
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler() {
      t.ok(agent.getTransaction(), "transaction should be visible");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () {
      ee.on('transaction', handler);
      ee.emit('transaction');
    });
  });

  t.test("e. two overlapping runs of an async transaction with setTimeout",
       {timeout : 5000},
       function (t) {
    t.plan(6);

    var first
      , second
      , agent = helper.loadMockedAgent()
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler(id) {
      t.ok(agent.getTransaction(), "transaction should be visible");
      t.equal(agent.getTransaction().id, id, "transaction matches");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () {
      first = agent.getTransaction().id;
      setTimeout(handler.bind(null, first), 100);
    });

    setTimeout(function () {
      helper.runInTransaction(agent, function () {
        second = agent.getTransaction().id;
        t.notEqual(first, second, "different transaction IDs");
        setTimeout(handler.bind(null, second), 100);
      });
    }, 25);
  });

  t.test("f. two overlapping runs of an async transaction with setInterval",
       {timeout : 5000},
       function (t) {
    t.plan(15);

    var agent = helper.loadMockedAgent();

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function runInterval() {
      var count = 0
        , handle
        , id
        ;

      function handler() {
        count += 1;
        if (count > 2) clearInterval(handle);
        t.ok(agent.getTransaction(), "transaction should be visible");
        t.equal(id, agent.getTransaction().id, "transaction ID should be immutable");
      }

      function run() {
        t.ok(agent.getTransaction(), "transaction should have been created");
        id = agent.getTransaction().id;
        handle = setInterval(handler, 50);
      }

      helper.runInTransaction(agent, run);
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    runInterval(); runInterval();
  });

  t.test("g. two overlapping runs of an async transaction with process.nextTick",
       {timeout : 5000},
       function (t) {
    t.plan(6);

    var first
      , second
      , agent = helper.loadMockedAgent()
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler(id) {
      var transaction = agent.getTransaction();
      t.ok(transaction, "transaction should be visible");
      t.equal((transaction || {}).id, id, "transaction matches");
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, function () {
      first = agent.getTransaction().id;
      process.nextTick(handler.bind(null, first));
    });

    process.nextTick(function () {
      helper.runInTransaction(agent, function () {
        second = agent.getTransaction().id;
        t.notEqual(first, second, "different transaction IDs");
        process.nextTick(handler.bind(null, second));
      });
    });
  });

  t.test("h. two overlapping async runs with EventEmitter.prototype.emit",
       {timeout : 5000},
       function (t) {
    t.plan(3);

    var agent = helper.loadMockedAgent()
      , ee    = new EventEmitter()
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function handler() {
      t.ok(agent.getTransaction(), "transaction should be visible");
    }

    function lifecycle() {
      ee.once('transaction', process.nextTick.bind(process, handler));
      ee.emit('transaction');
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, lifecycle);
    helper.runInTransaction(agent, lifecycle);
  });

  t.test("i. async transaction with an async sub-call with setTimeout",
       {timeout : 5000},
       function (t) {
    t.plan(5);

    var agent = helper.loadMockedAgent();

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function inner(callback) {
      setTimeout(function () {
        t.ok(agent.getTransaction(), "transaction should -- yep -- still be visible");
        callback();
      }, 50);
    }

    function outer() {
      t.ok(agent.getTransaction(), "transaction should be visible");
      setTimeout(function () {
        t.ok(agent.getTransaction(), "transaction should still be visible");
        inner(function () {
          t.ok(agent.getTransaction(), "transaction should even still be visible");
        });
      }, 50);
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, setTimeout.bind(null, outer, 50));
  });

  t.test("j. async transaction with an async sub-call with setInterval",
       {timeout : 5000},
       function (t) {
    t.plan(5);

    var agent = helper.loadMockedAgent()
      , outerHandle
      , innerHandle
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function inner(callback) {
      innerHandle = setInterval(function () {
        clearInterval(innerHandle);
        t.ok(agent.getTransaction(), "transaction should -- yep -- still be visible");
        callback();
      }, 50);
    }

    function outer() {
      t.ok(agent.getTransaction(), "transaction should be visible");
      outerHandle = setInterval(function () {
        clearInterval(outerHandle);
        t.ok(agent.getTransaction(), "transaction should still be visible");
        inner(function () {
          t.ok(agent.getTransaction(), "transaction should even still be visible");
        });
      }, 50);
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, outer);
  });

  t.test("k. async transaction with an async sub-call with process.nextTick",
       {timeout : 5000},
       function (t) {
    t.plan(5);

    var agent = helper.loadMockedAgent();

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    function inner(callback) {
      process.nextTick(function () {
        t.ok(agent.getTransaction(), "transaction should -- yep -- still be visible");
        callback();
      });
    }

    function outer() {
      t.ok(agent.getTransaction(), "transaction should be visible");
      process.nextTick(function () {
        t.ok(agent.getTransaction(), "transaction should still be visible");
        inner(function () {
          t.ok(agent.getTransaction(), "transaction should even still be visible");
        });
      });
    }

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    /* This used to use process.nextTick.bind(process, outer), but CLS will
     * capture the wrong context (before the transaction is created) if you bind
     * in the parameter list instead of within helper.runInTransaction's callback.
     * There may be a subtle bug in CLS lurking here.
     */
    helper.runInTransaction(agent, function () { process.nextTick(outer); });
  });

  t.test("l. async transaction with an async sub-call with EventEmitter.prototype.emit",
       {timeout : 5000},
       function (t) {
    t.plan(4);

    var agent = helper.loadMockedAgent()
      , outer = new EventEmitter()
      , inner = new EventEmitter()
      ;

    this.tearDown(function () {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) agent.getTransaction().end();
      helper.unloadAgent(agent);
    });

    inner.on('pong', function (callback) {
      t.ok(agent.getTransaction(), "transaction should still be visible");
      callback();
    });

    function outerCallback() {
      t.ok(agent.getTransaction(), "transaction should even still be visible");
    }

    outer.on('ping', function () {
      t.ok(agent.getTransaction(), "transaction should be visible");
      inner.emit('pong', outerCallback);
    });

    t.notOk(agent.getTransaction(), "transaction should not yet be visible");
    helper.runInTransaction(agent, outer.emit.bind(outer, 'ping'));
  });
});
