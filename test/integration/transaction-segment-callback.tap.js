'use strict';

var util = require('util')
  , tap  = require('tap')
  , test = tap.test
  ;

/**
 *
 *
 * THE MODEL:
 *
 * A simple set of classes intended to model a call chain within the scope of
 * a New Relic transaction trace. The players are transactions (e.g. web page
 * requests), trace segments for subsidiary calls (e.g. database or memcached
 * calls), and instrumented callbacks.
 *
 * The goal is to be able to model the scenarios outlined in the test cases,
 * copied up here for easy reference:
 *
 * a. direct function execution
 * b. an asynchronous function -- that is, a function that returns a callback,
 *    that can be executed at an arbitrary future time
 * c. two overlapping executions of an asynchronous function and its callback
 * d. direct function execution, including direct execution of an instrumented
 *    subsidiary function
 * e. an asynchronous function that calls an asynchronous subsidiary function
 * f. two overlapping executions of an asynchronous function with an
 *    asynchronous subsidiary function
 *
 * Here are some of the rules the model is intended to follow:
 *
 * 1. Every call, segment, and transaction has an ID (for the purposes of these
 *    tests, that ID is derived from how many of each thing are associated
 *    with a given trace).
 * 2. Every Call is associated with a Segment.
 * 3. Every Segment is associated with a Trace.
 *
 *
 */

/**
 * CALL
 */
function Call(id, segment) {
  if (!id) throw new Error("Calls must have an ID.");
  if (!segment) throw new Error("Calls must be associated with a segment.");

  this.id = id;
  this.segment = segment;
}


/**
 * SEGMENT
 */
function Segment(id, transaction) {
  if (!id) throw new Error("Segments must have an ID.");
  if (!transaction) throw new Error("Segments must be associated with a transaction.");

  this.id = id;
  this.transaction = transaction;

  this.numCalls = 0;
}

Segment.prototype.addCall = function () {
  this.numCalls += 1;
  return new Call(this.numCalls, this);
};


/**
 * TRANSACTION
 */
function Transaction (id) {
  if (!id) throw new Error("Transactions must have an ID.");

  this.id = id;

  this.numSegments = 0;
}

Transaction.prototype.addSegment = function () {
  this.numSegments += 1;
  return new Segment(this.numSegments, this);
};


/**
 * CONTEXT
 *
 * This does very little right now except act as a shared state used
 * by all the tracers in effect to keep track of the current transaction
 * and trace segment. The exit call is VERY IMPORTANT, because it is
 * how the proxying methods in the tracer know whether or not a call
 * is part of a transaction / segment.
 *
 * The relevant code in the Tracer can be adapted to use domains instead
 * of Context very easily, which should make it easy to support both
 * 0.8 and earlier versions from most of the same code.
 */
function Context(debug) {
  // used to ensure that entries and exits remain paired
  if (debug) this.stack = [];
}

Context.prototype.enter = function (call) {
  if (this.stack) this.stack.push(call);

  this.call = call;
  this.segment = call.segment;
  this.transaction = call.segment.transaction;
};

Context.prototype.exit = function (call) {
  if (this.stack) {
    var top = this.stack.pop();
    if (top !== call) throw new Error("You must exit every context you enter.");
  }

  delete this.call;
  delete this.segment;
  delete this.transaction;
};


/**
 * EXECUTION TRACER
 *
 * One instance of this class exists per transaction, with the state
 * representing the current context shared between multiple instances.
 *
 * The transaction tracer works by wrapping either the generator functions
 * that asynchronously handle incoming requests (via
 * Tracer.transactionProxy and Tracer.segmentProxy) or direct function
 * calls in the form of callbacks (via Tracer.callbackProxy).
 *
 * In both cases, the wrappers exist to set up the execution context for
 * the wrapped functions. The context is effectively global, and works in
 * a manner similar to Node 0.8's domains, by explicitly setting up and
 * tearing down the current transaction / segment / call around each
 * wrapped function's invocation. It relies upon the fact that Node is
 * single-threaded, and requires that each entry and exit be paired
 * appropriately so that the context is left in its proper state.
 *
 */
function Tracer(context) {
  if (!context) throw new Error("Must include shared context.");
  this.numTransactions = 0;
  this.context = context;

  this.trace     = [];
  this.creations = [];
  this.wrappings = [];

  this.verbose   = [];
}

Tracer.prototype.internalTraceCall = function (direction, call) {
  var id = util.format("%sT%dS%dC%d",
                       direction,
                       call.segment.transaction.id,
                       call.segment.id,
                       call.id);
  this.trace.push(id);
  this.verbose.push(id);
};

Tracer.prototype.internalTraceCreation = function (type) {
  var creation = util.format("+%s", type[0]);
  this.creations.push(creation);
  this.verbose.push(creation);
};

Tracer.prototype.internalTraceWrapping = function (direction, type) {
  var wrapping = util.format("%s%s", direction, type);
  this.wrappings.push(wrapping);
  this.verbose.push(wrapping);
};

Tracer.prototype.wrapInternalTrace = function (type, handler) {
  var self = this;
  return function () {
    self.internalTraceWrapping('->', type);
    var returned = handler.apply(this, arguments);
    self.internalTraceWrapping('<-', type);

    return returned;
  };
};

Tracer.prototype.enter = function (call) {
  this.internalTraceCall('->', call);
  this.context.enter(call);
};

Tracer.prototype.exit = function (call) {
  this.internalTraceCall('<-', call);
  this.context.exit(call);
};

Tracer.prototype.addTransaction = function () {
  this.numTransactions += 1;

  this.internalTraceCreation('Trace');
  return new Transaction(this.numTransactions);
};

Tracer.prototype.addSegment = function (transaction) {
  if (!transaction) transaction = this.addTransaction();

  this.internalTraceCreation('Segment');
  return transaction.addSegment();
};

Tracer.prototype.addCall = function (segment) {
  if (!segment) segment = this.addSegment();

  this.internalTraceCreation('Call');
  return segment.addCall();
};

/**
 * Use transactionProxy to wrap a closure that is a top-level handler that is
 * meant to originate transactions. This is meant to wrap the first half of
 * async calls, not their callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.transactionProxy = function (handler) {
  var self = this;
  return this.wrapInternalTrace('T outer', function () {
    return self.wrapInternalTrace('T inner', function () {
      var call = self.addCall();

      self.enter(call);
      var returned = handler.apply(this, arguments);
      self.exit(call);

      return returned;
    });
  })(); // <-- call immediately
};

/**
 * Use segmentProxy to wrap a closure that is a top-level handler that is
 * meant to participate in an existing transaction. It will add itself as a
 * new subsidiary to the current transaction. This is meant to wrap the first
 * half of async calls, not their callbacks.
 *
 * @param {Function} handler Generator to be proxied.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.segmentProxy = function (handler) {
  var self = this;
  return this.wrapInternalTrace('S outer', function () {
    return self.wrapInternalTrace('S inner', function () {
      // don't implicitly create transactions
      if (!self.context.transaction) return handler.apply(this, arguments);

      var segment = self.addSegment(self.context.transaction)
        , call    = self.addCall(segment)
        ;

      self.enter(call);
      var returned = handler.apply(this, arguments);
      self.exit(call);

      return returned;
    });
  })(); // <-- call immediately
};

/**
 * Use callbackProxy to wrap a closure that may invoke subsidiary functions that
 * want access to the current transaction. When called, it sets up the correct
 * context before invoking the original function (and tears it down afterwards).
 *
 * Proxying of individual calls is only meant to be done within the scope of
 * an existing transaction. It
 *
 * @param {Function} handler Function to be proxied on invocation.
 * @returns {Function} Proxied function.
 */
Tracer.prototype.callbackProxy = function (handler) {
  // don't implicitly create transactions
  if (!this.context.transaction) return handler;

  var self = this;
  return this.wrapInternalTrace('C outer', function () {
    var call = self.addCall(self.context.segment);

    return self.wrapInternalTrace('C inner', function () {
      self.enter(call);
      var returned = handler.apply(this, arguments);
      self.exit(call);

      return returned;
    });
  })(); // <-- call immediately
};


/**
 *
 * TEST CASES
 *
 */

// set up shared context
var context = new Context(true); // want to ensure that enter/exit are paired

// a. synchronous handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> CALL T1S1C1: 1. execution enters handler
//     <- CALL T1S1C1: 2. execution exits handler
//   <- SEGMENT T1S1
// <- TRANSACTION T1
test("a. synchronous handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(context);

  var handler = function (multiplier, multiplicand) {
    return multiplier * multiplicand;
  };
  var wrapped = tracer.transactionProxy(handler);

  var product = wrapped(5, 7);
  t.equal(product, 35, "wrapped function still works");

  var creations = [
    '+T', '+S', '+C' // handler invocation
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->T outer', '<-T outer', // handler proxying
    '->T inner', '<-T inner', // handler invocation
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '<-T1S1C1'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match.");

  var full = [
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1', '<-T1S1C1',
    '<-T inner',
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});


// b. asynchronous handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> CALL T1S1C1: 1. execution enters handler
//     <- CALL T1S1C1: 2. execution exits handler
// ---
//     -> CALL T1S1C2: 3. execution enters callback
//     <- CALL T1S1C2: 4. execution exits callback
//   <- SEGMENT T1S1
// <- TRANSACTION T1
test("b. asynchronous handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(context);

  var handler = function (multiplier) {
    var callback = function (multiplicand) {
      return multiplier * multiplicand;
    };

    return tracer.callbackProxy(callback);
  };

  var wrapped = tracer.transactionProxy(handler);
  var cb = wrapped(3);
  var product = cb(11);
  t.equal(product, 33, "wrapped function still works");

  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+C'              // callback invocation
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->T outer', '<-T outer', // handler proxying
    '->T inner',              // handler invocation
      '->C outer', '<-C outer', // callback proxying
    '<-T inner',
    '->C inner', '<-C inner'  // callback invocation
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '<-T1S1C1',
    '->T1S1C2',
    '<-T1S1C2'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match");

  var full = [
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1',
      '->C outer',
        '+C',
      '<-C outer',
      '<-T1S1C1',
    '<-T inner',
    '->C inner',
      '->T1S1C2', '<-T1S1C2',
    '<-C inner'
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});

// c. two overlapping executions of an asynchronous handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> CALL T1S1C1: 1. execution enters handler (1st time)
//     <- CALL T1S1C1: 2. execution exits handler (1st time)
// ---
// -> TRANSACTION T2
//   -> SEGMENT T2S1
//     -> CALL T2S1C1: 3. execution enters handler (2nd time)
//     <- CALL T2S1C1: 4. execution exits handler (2nd time)
// ---
//     -> CALL T1S1C2: 5. execution enters 1st callback
//     <- CALL T1S1C2: 6. execution exits 1st callback
//   <- SEGMENT T1S1
// <- TRANSACTION T1
// ---
//     -> CALL T2S1C2: 7. execution enters 2nd callback
//     <- CALL T2S1C2: 8. execution exits 2nd callback
//   <- SEGMENT T2S1
// <- TRANSACTION T2
test("c. two overlapping executions of an asynchronous handler", function (t) {
  t.plan(6);

  var tracer = new Tracer(context);

  var handler = function (multiplier) {
    var callback = function (multiplicand) {
      return multiplier * multiplicand;
    };

    return tracer.callbackProxy(callback);
  };
  var wrapped = tracer.transactionProxy(handler);

  var cb1 = wrapped(3);
  var cb2 = wrapped(5);

  var product1 = cb1(7);
  t.equal(product1, 21, "wrapped function still works");
  var product2 = cb2(11);
  t.equal(product2, 55, "wrapped function still works");

  var creations = [
    '+T', '+S', '+C', // 1st handler invocation
    '+C',             // 1st callback proxying
    '+T', '+S', '+C', // 2nd handler invocation
    '+C'              // 2nd callback proxying
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->T outer', '<-T outer', // transaction proxying
    '->T inner',              // 1st handler invocation
    '->C outer', '<-C outer', // 1st callback proxying
    '<-T inner',
    '->T inner',              // 2nd handler invocation
    '->C outer', '<-C outer', // 2nd callback proxying
    '<-T inner',
    '->C inner', '<-C inner', // 1st callback invocation
    '->C inner', '<-C inner'  // 2nd callback invocation
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '<-T1S1C1',
    '->T2S1C1',
    '<-T2S1C1',
    '->T1S1C2',
    '<-T1S1C2',
    '->T2S1C2',
    '<-T2S1C2'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match");

  var full = [
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1',
        '->C outer',
          '+C',
        '<-C outer',
      '<-T1S1C1',
    '<-T inner',
    '->T inner',
      '+T', '+S', '+C',
      '->T2S1C1',
        '->C outer',
          '+C',
        '<-C outer',
      '<-T2S1C1',
    '<-T inner',
    '->C inner',
      '->T1S1C2', '<-T1S1C2',
    '<-C inner',
    '->C inner',
      '->T2S1C2', '<-T2S1C2',
    '<-C inner'
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});

// d. synchronous handler with synchronous subsidiary handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> CALL T1S1C1: 1. execution enters handler
//   -> SEGMENT T1S2
//     -> CALL T1S2C1: 2. execution enters subsidiary handler
//     <- CALL T1S2C1: 3. execution exits subsidiary handler
//   <- SEGMENT T1S2
//     <- CALL T1S1C1: 4. execution exits handler
//   <- SEGMENT T1S1
// <- TRANSACTION T1
test("d. synchronous handler with synchronous subsidiary handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(context);

  var subsidiary = function (value, addend) {
    return value + addend;
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var handler = function (multiplier, multiplicand) {
    var product = multiplier * multiplicand;

    return wrappedSubsidiary(product, 7);
  };
  var wrapped = tracer.transactionProxy(handler);

  var result = wrapped(3, 5);
  t.equals(result, 22, "wrapped function still works");

  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+S', '+C'        // subsidiary handler invocation
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->S outer', '<-S outer', // segment proxying
    '->T outer', '<-T outer', // transaction proxying
    '->T inner',              // handler invocation
    '->S inner', '<-S inner', // subsidiary handler invocation
    '<-T inner'
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '->T1S2C1',
    '<-T1S2C1',
    '<-T1S1C1'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match");

  var full = [
    '->S outer', '<-S outer',
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1',
        '->S inner',
          '+S', '+C',
          '->T1S2C1', '<-T1S2C1',
        '<-S inner',
      '<-T1S1C1',
    '<-T inner'
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});

// e. asynchronous handler with an asynchronous subsidiary handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> T1S1C1: 1. execution enters handler
//   -> SEGMENT T1S2
//     -> T1S2C1: 2. execution enters subsidiary handler
//     <- T1S2C1: 3. execution exits subsidiary handler
//   -> SEGMENT T1S1
//     <- T1S1C1: 4. execution exits handler
// ---
//   -> SEGMENT T1S2
//     -> T1S2C2: 5. execution enters subsidiary callback
//   -> SEGMENT T1S1
//     -> T1S1C2: 6. execution enters handler callback
//     <- T1S1C2: 7. execution exits handler callback
//   <- SEGMENT T1S1
//     <- T1S2C2: 8. execution exits subsidiary callback
//   <- SEGMENT T1S2
// <- TRANSACTION T1
test("e. asynchronous handler with an asynchronous subsidiary handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(context);

  var subsidiary = function (value, next) {
    var inner = function (addend, divisor) {
      return next(value + addend, divisor);
    };

    return tracer.callbackProxy(inner);
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var handler = function (multiplier, multiplicand, callback) {
    var next = function (value, divisor) {
      return value / divisor;
    };

    var wrappedNext = tracer.callbackProxy(next);
    return callback(multiplier * multiplicand, wrappedNext);
  };
  var wrapped = tracer.transactionProxy(handler);

  var cb = wrapped(11, 13, wrappedSubsidiary);
  var result = cb(17, 2);
  t.equals(result, 80, "wrapped functions still work");

  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+C',             // handler callback invocation
    '+S', '+C',       // subsidiary handler invocation
    '+C'              // subsidiary handler callback invocation
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->S outer', '<-S outer', // segment proxying -- purposefully out of order!
    '->T outer', '<-T outer', // transaction proxying
    '->T inner',              // handler invocation
    '->C outer', '<-C outer', // handler callback proxying
    '->S inner',              // subsidiary handler invocation
    '->C outer', '<-C outer', // subsidiary handler callback proxying
    '<-S inner',
    '<-T inner',
    '->C inner',              // subsidiary handler callback invocation
    '->C inner', '<-C inner', // handler callback invocation
    '<-C inner'
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '->T1S2C1',
    '<-T1S2C1',
    '<-T1S1C1',
    '->T1S2C2',
    '->T1S1C2',
    '<-T1S1C2',
    '<-T1S2C2'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match");

  var full = [
    '->S outer', '<-S outer',
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1',
        '->C outer',
          '+C',
        '<-C outer',
        '->S inner',
          '+S', '+C',
          '->T1S2C1',
            '->C outer',
              '+C',
            '<-C outer',
          '<-T1S2C1',
        '<-S inner',
      '<-T1S1C1',
    '<-T inner',
    '->C inner',
      '->T1S2C2',
        '->C inner',
          '->T1S1C2', '<-T1S1C2',
        '<-C inner',
      '<-T1S2C2',
    '<-C inner'
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});

// f. two overlapping executions of an asynchronous handler with an asynchronous subsidiary handler
//
// -> TRANSACTION T1
//   -> SEGMENT T1S1
//     -> CALL T1S1C1: 1. execution enters handler (1st time)
//   -> SEGMENT T1S2
//     -> CALL T1S2C1: 2. execution enters subsidiary handler (1st time)
//     <- CALL T1S2C1: 3. execution exits subsidiary handler (1st time)
//     <- CALL T1S1C1: 4. execution exits handler (1st time)
// ---
// -> TRANSACTION T2
//   -> SEGMENT T2S1
//     -> CALL T2S1C1: 5. execution enters handler (2nd time)
//   -> SEGMENT T2S2
//     -> CALL T2S2C1: 6. execution enters subsidiary handler (2nd time)
//     <- CALL T2S2C1: 7. execution exits subsidiary handler (2nd time)
//     <- CALL T1S1C1: 8. execution exits handler (2nd time)
// ---
//     -> CALL T1S2C2: 9. execution enters 1st subsidiary callback
//   <- SEGMENT T1S2
//     -> CALL T1S1C2: 10. execution enters 1st handler callback
//     <- CALL T1S1C2: 11. execution exits 1st handler callback
//   <- SEGMENT T1S1
//     <- CALL T1S2C2: 12. execution exits 1st subsidiary callback
// <- TRANSACTION T1
// ---
//     -> CALL T2S2C2: 13. execution enters 2nd subsidiary callback
//   <- SEGMENT T2S2
//     -> CALL T2S1C2: 14. execution enters 2nd handler callback
//     <- CALL T2S1C2: 15. execution exits 2nd handler callback
//   <- SEGMENT T2S1
//     <- CALL T2S2C2: 16. execution exits 2nd subsidiary callback
// <- TRANSACTION T2
test("f. two overlapping executions of an asynchronous handler with an asynchronous subsidiary handler", function (t) {
  t.plan(6);

  var tracer = new Tracer(context);

  var subsidiary = function (value, next) {
    var inner = function (addend, divisor) {
      return next(value + addend, divisor);
    };

    return tracer.callbackProxy(inner);
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var handler = function (multiplier, multiplicand, callback) {
    var next = function (value, divisor) {
      return value / divisor;
    };

    var wrappedNext = tracer.callbackProxy(next);
    return callback(multiplier * multiplicand, wrappedNext);
  };
  var wrapped = tracer.transactionProxy(handler);

  var cb1 = wrapped(2, 9, wrappedSubsidiary);
  var cb2 = wrapped(7, 11, wrappedSubsidiary);

  var result1 = cb1(15, 3);
  t.equals(result1, 11, "wrapped functions still work");
  var result2 = cb2(13, 2);
  t.equals(result2, 45, "wrapped functions still work");

  var creations = [
    '+T', '+S', '+C', // 1st handler invocation
    '+C',             // 1st callback invocation
    '+S', '+C',       // 1st subsidiary handler invocation
    '+C',             // 1st subsidiary callback invocation
    '+T', '+S', '+C', // 2nd handler invocation
    '+C',             // 2nd callback invocation
    '+S', '+C',       // 2nd subsidiary handler invocation
    '+C'              // 2nd subsidiary callback invocation
  ];
  t.deepEquals(tracer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->S outer', '<-S outer', // segment proxying -- purposefully out of order!
    '->T outer', '<-T outer', // transaction proxying
    '->T inner',              // 1st handler invocation
    '->C outer', '<-C outer', // 1st handler callback proxying
    '->S inner',              // 1st subsidiary handler invocation
    '->C outer', '<-C outer', // 1st subsidiary callback wrapping
    '<-S inner',
    '<-T inner',
    '->T inner',              // 2nd handler invocation
    '->C outer', '<-C outer', // 2nd handler callback proxying
    '->S inner',              // 2nd subsidiary handler invocation
    '->C outer', '<-C outer', // 2nd subsidiary callback wrapping
    '<-S inner',
    '<-T inner',
    '->C inner',              // 1st subsidiary callback invocation
    '->C inner', '<-C inner', // 1st handler callback invocation
    '<-C inner',
    '->C inner',              // 2nd subsidiary callback invocation
    '->C inner', '<-C inner', // 2nd handler callback invocation
    '<-C inner'
  ];
  t.deepEquals(tracer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '->T1S2C1',
    '<-T1S2C1',
    '<-T1S1C1',
    '->T2S1C1',
    '->T2S2C1',
    '<-T2S2C1',
    '<-T2S1C1',
    '->T1S2C2',
    '->T1S1C2',
    '<-T1S1C2',
    '<-T1S2C2',
    '->T2S2C2',
    '->T2S1C2',
    '<-T2S1C2',
    '<-T2S2C2'
  ];
  t.deepEquals(tracer.trace, calls, "call entry / exit sequence should match");

  var full = [
    '->S outer', '<-S outer',
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1',
        '->C outer',
          '+C',
        '<-C outer',
        '->S inner',
          '+S', '+C',
          '->T1S2C1',
            '->C outer',
              '+C',
            '<-C outer',
          '<-T1S2C1',
        '<-S inner',
      '<-T1S1C1',
    '<-T inner',
    '->T inner',
      '+T', '+S', '+C',
      '->T2S1C1',
        '->C outer',
          '+C',
        '<-C outer',
        '->S inner',
          '+S', '+C',
          '->T2S2C1',
            '->C outer',
              '+C',
            '<-C outer',
          '<-T2S2C1',
        '<-S inner',
      '<-T2S1C1',
    '<-T inner',
    '->C inner',
      '->T1S2C2',
        '->C inner',
          '->T1S1C2', '<-T1S1C2',
        '<-C inner',
      '<-T1S2C2',
    '<-C inner',
    '->C inner',
      '->T2S2C2',
        '->C inner',
          '->T2S1C2', '<-T2S1C2',
        '<-C inner',
      '<-T2S2C2',
    '<-C inner'
  ];
  t.deepEquals(tracer.verbose, full, "full trace should match.");
});
