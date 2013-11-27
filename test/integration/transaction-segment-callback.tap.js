'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , Tracer  = require(path.join(__dirname, '..', '..', 'lib',
                                'transaction', 'tracer', 'debug'))
  ;


/**
 *
 * TEST CASES
 *
 */

// set up shared context
var agent = helper.loadMockedAgent();

/* a. synchronous handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> CALL T1S1C1: 1. execution enters handler
 *     <- CALL T1S1C1: 2. execution exits handler
 *   <- SEGMENT T1S1
 * <- TRANSACTION T1
 */
test("a. synchronous handler", function (t) {
  t.plan(7);

  var tracer = new Tracer(agent);

  var transaction;
  var handler = function (multiplier, multiplicand) {
    transaction = tracer.getTransaction();
    t.ok(transaction, "should find transaction in handler");

    return multiplier * multiplicand;
  };
  var wrapped = tracer.transactionProxy(handler);

  var product = wrapped(5, 7);
  t.equal(product, 35, "wrapped function still works");

  var describer = transaction.describer;
  t.ok(describer, "describer should be on transaction");
  var creations = [
    '+T', '+S', '+C' // handler invocation
  ];
  t.deepEquals(describer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->T outer', '<-T outer', // handler proxying
    '->T inner', '<-T inner' // handler invocation
  ];
  t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '<-T1S1C1'
  ];
  t.deepEquals(describer.trace, calls, "call entry / exit sequence should match.");

  var full = [
    '->T outer', '<-T outer',
    '->T inner',
      '+T', '+S', '+C',
      '->T1S1C1', '<-T1S1C1',
    '<-T inner'
  ];
  t.deepEquals(describer.verbose, full, "full trace should match.");
});

/* b. asynchronous handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> CALL T1S1C1: 1. execution enters handler
 *     <- CALL T1S1C1: 2. execution exits handler
 * ---
 *     -> CALL T1S1C2: 3. execution enters callback
 *     <- CALL T1S1C2: 4. execution exits callback
 *   <- SEGMENT T1S1
 * <- TRANSACTION T1
 */
test("b. asynchronous handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(agent);

  var transaction;
  var handler = function (multiplier) {
    transaction = tracer.getTransaction();

    var callback = function (multiplicand) {
      return multiplier * multiplicand;
    };

    return tracer.callbackProxy(callback);
  };

  var wrapped = tracer.transactionProxy(handler);
  var cb = wrapped(3);
  var product = cb(11);
  t.equal(product, 33, "wrapped function still works");

  var describer = transaction.describer;
  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+C'              // callback invocation
  ];
  t.deepEquals(describer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->T outer', '<-T outer', // handler proxying
    '->T inner',              // handler invocation
      '->C outer', '<-C outer', // callback proxying
    '<-T inner',
    '->C inner', '<-C inner'  // callback invocation
  ];
  t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '<-T1S1C1',
    '->T1S1C2',
    '<-T1S1C2'
  ];
  t.deepEquals(describer.trace, calls, "call entry / exit sequence should match");

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
  t.deepEquals(describer.verbose, full, "full trace should match.");
});

/* c. two overlapping executions of an asynchronous handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> CALL T1S1C1: 1. execution enters handler (1st time)
 *     <- CALL T1S1C1: 2. execution exits handler (1st time)
 * ---
 * -> TRANSACTION T2
 *   -> SEGMENT T2S1
 *     -> CALL T2S1C1: 3. execution enters handler (2nd time)
 *     <- CALL T2S1C1: 4. execution exits handler (2nd time)
 * ---
 *     -> CALL T1S1C2: 5. execution enters 1st callback
 *     <- CALL T1S1C2: 6. execution exits 1st callback
 *   <- SEGMENT T1S1
 * <- TRANSACTION T1
 * ---
 *     -> CALL T2S1C2: 7. execution enters 2nd callback
 *     <- CALL T2S1C2: 8. execution exits 2nd callback
 *   <- SEGMENT T2S1
 * <- TRANSACTION T2
 */
test("c. two overlapping executions of an asynchronous handler", function (t) {
  t.plan(11);

  var tracer = new Tracer(agent);

  var transactions = [];
  var handler = function (multiplier) {
    transactions.push(tracer.getTransaction());

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

  t.equals(transactions.length, 2, "should have tracked 2 transactions.");
  transactions.forEach(function (transaction, index) {
    var describer = transaction.describer;
    var creations = [
      '+T', '+S', '+C', // handler invocation
      '+C'             // callback proxying
    ];
    t.deepEquals(describer.creations, creations, "creation sequence should match.");

    var wrappings = [
      '->T outer', '<-T outer', // transaction proxying
      '->T inner',              // handler invocation
      '->C outer', '<-C outer', // callback proxying
      '<-T inner',
      '->C inner', '<-C inner'  // callback invocation
    ];
    t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

    var i = index + 1;
    var calls = [
      '->T'+i+'S1C1',
      '<-T'+i+'S1C1',
      '->T'+i+'S1C2',
      '<-T'+i+'S1C2'
    ];
    t.deepEquals(describer.trace, calls, "call entry / exit sequence should match");

    var full = [
      '->T outer', '<-T outer',
      '->T inner',
        '+T', '+S', '+C',
        '->T'+i+'S1C1',
          '->C outer',
            '+C',
          '<-C outer',
        '<-T'+i+'S1C1',
      '<-T inner',
      '->C inner',
        '->T'+i+'S1C2', '<-T'+i+'S1C2',
      '<-C inner'
    ];
    t.deepEquals(describer.verbose, full, "full trace should match.");
  });
});

/* d. synchronous handler with synchronous subsidiary handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> CALL T1S1C1: 1. execution enters handler
 *   -> SEGMENT T1S2
 *     -> CALL T1S2C1: 2. execution enters subsidiary handler
 *     <- CALL T1S2C1: 3. execution exits subsidiary handler
 *   <- SEGMENT T1S2
 *     <- CALL T1S1C1: 4. execution exits handler
 *   <- SEGMENT T1S1
 * <- TRANSACTION T1
 */
test("d. synchronous handler with synchronous subsidiary handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(agent);

  var subsidiary = function (value, addend) {
    return value + addend;
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var transaction;
  var handler = function (multiplier, multiplicand) {
    transaction = tracer.getTransaction();
    var product = multiplier * multiplicand;

    return wrappedSubsidiary(product, 7);
  };
  var wrapped = tracer.transactionProxy(handler);

  var result = wrapped(3, 5);
  t.equals(result, 22, "wrapped function still works");

  var describer = transaction.describer;
  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+S', '+C'        // subsidiary handler invocation
  ];
  t.deepEquals(describer.creations, creations, "creation sequence should match.");

  var wrappings = [
    '->S outer', '<-S outer', // segment proxying
    '->T outer', '<-T outer', // transaction proxying
    '->T inner',              // handler invocation
    '->S inner', '<-S inner', // subsidiary handler invocation
    '<-T inner'
  ];
  t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

  var calls = [
    '->T1S1C1',
    '->T1S2C1',
    '<-T1S2C1',
    '<-T1S1C1'
  ];
  t.deepEquals(describer.trace, calls, "call entry / exit sequence should match");

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
  t.deepEquals(describer.verbose, full, "full trace should match.");
});

/* e. asynchronous handler with an asynchronous subsidiary handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> T1S1C1: 1. execution enters handler
 *   -> SEGMENT T1S2
 *     -> T1S2C1: 2. execution enters subsidiary handler
 *     <- T1S2C1: 3. execution exits subsidiary handler
 *   -> SEGMENT T1S1
 *     <- T1S1C1: 4. execution exits handler
 * ---
 *   -> SEGMENT T1S2
 *     -> T1S2C2: 5. execution enters subsidiary callback
 *   -> SEGMENT T1S1
 *     -> T1S1C2: 6. execution enters handler callback
 *     <- T1S1C2: 7. execution exits handler callback
 *   <- SEGMENT T1S1
 *     <- T1S2C2: 8. execution exits subsidiary callback
 *   <- SEGMENT T1S2
 * <- TRANSACTION T1
 */
test("e. asynchronous handler with an asynchronous subsidiary handler", function (t) {
  t.plan(5);

  var tracer = new Tracer(agent);

  var subsidiary = function (value, next) {
    var inner = function (addend, divisor) {
      return next(value + addend, divisor);
    };

    return tracer.callbackProxy(inner);
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var transaction;
  var handler = function (multiplier, multiplicand, callback) {
    transaction = tracer.getTransaction();
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

  var describer = transaction.describer;
  var creations = [
    '+T', '+S', '+C', // handler invocation
    '+C',             // handler callback invocation
    '+S', '+C',       // subsidiary handler invocation
    '+C'              // subsidiary handler callback invocation
  ];
  t.deepEquals(describer.creations, creations, "creation sequence should match.");

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
  t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

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
  t.deepEquals(describer.trace, calls, "call entry / exit sequence should match");

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
  t.deepEquals(describer.verbose, full, "full trace should match.");
});

/* f. two overlapping executions of an async handler with an async subsidiary handler
 *
 * -> TRANSACTION T1
 *   -> SEGMENT T1S1
 *     -> CALL T1S1C1: 1. execution enters handler (1st time)
 *   -> SEGMENT T1S2
 *     -> CALL T1S2C1: 2. execution enters subsidiary handler (1st time)
 *     <- CALL T1S2C1: 3. execution exits subsidiary handler (1st time)
 *     <- CALL T1S1C1: 4. execution exits handler (1st time)
 * ---
 * -> TRANSACTION T2
 *   -> SEGMENT T2S1
 *     -> CALL T2S1C1: 5. execution enters handler (2nd time)
 *   -> SEGMENT T2S2
 *     -> CALL T2S2C1: 6. execution enters subsidiary handler (2nd time)
 *     <- CALL T2S2C1: 7. execution exits subsidiary handler (2nd time)
 *     <- CALL T1S1C1: 8. execution exits handler (2nd time)
 * ---
 *     -> CALL T1S2C2: 9. execution enters 1st subsidiary callback
 *   <- SEGMENT T1S2
 *     -> CALL T1S1C2: 10. execution enters 1st handler callback
 *     <- CALL T1S1C2: 11. execution exits 1st handler callback
 *   <- SEGMENT T1S1
 *     <- CALL T1S2C2: 12. execution exits 1st subsidiary callback
 * <- TRANSACTION T1
 * ---
 *     -> CALL T2S2C2: 13. execution enters 2nd subsidiary callback
 *   <- SEGMENT T2S2
 *     -> CALL T2S1C2: 14. execution enters 2nd handler callback
 *     <- CALL T2S1C2: 15. execution exits 2nd handler callback
 *   <- SEGMENT T2S1
 *     <- CALL T2S2C2: 16. execution exits 2nd subsidiary callback
 * <- TRANSACTION T2
 */
test("f. two overlapping executions of an async handler with an async subsidiary handler",
     function (t) {
  t.plan(11);

  var tracer = new Tracer(agent);

  var subsidiary = function (value, next) {
    var inner = function (addend, divisor) {
      return next(value + addend, divisor);
    };

    return tracer.callbackProxy(inner);
  };
  var wrappedSubsidiary = tracer.segmentProxy(subsidiary);

  var transactions = [];
  var handler = function (multiplier, multiplicand, callback) {
    transactions.push(tracer.getTransaction());

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

  t.equals(transactions.length, 2, "should have tracked 2 transactions.");
  transactions.forEach(function (transaction, index) {
    var describer = transaction.describer;
    var creations = [
      '+T', '+S', '+C', // 1st handler invocation
      '+C',             // 1st callback invocation
      '+S', '+C',       // 1st subsidiary handler invocation
      '+C'             // 1st subsidiary callback invocation
    ];
    t.deepEquals(describer.creations, creations, "creation sequence should match.");

    var wrappings = [
      '->S outer', '<-S outer', // segment proxying -- purposefully out of order!
      '->T outer', '<-T outer', // transaction proxying
      '->T inner',              // handler invocation
      '->C outer', '<-C outer', // handler callback proxying
      '->S inner',              // subsidiary handler invocation
      '->C outer', '<-C outer', // subsidiary callback wrapping
      '<-S inner',
      '<-T inner',
      '->C inner',              // subsidiary callback invocation
      '->C inner', '<-C inner', // handler callback invocation
      '<-C inner'
    ];
    t.deepEquals(describer.wrappings, wrappings, "wrapping sequence should match.");

    var i = index + 1;
    var calls = [
      '->T'+i+'S1C1',
      '->T'+i+'S2C1',
      '<-T'+i+'S2C1',
      '<-T'+i+'S1C1',
      '->T'+i+'S2C2',
      '->T'+i+'S1C2',
      '<-T'+i+'S1C2',
      '<-T'+i+'S2C2'
    ];
    t.deepEquals(describer.trace, calls, "call entry / exit sequence should match");

    var full = [
      '->S outer', '<-S outer',
      '->T outer', '<-T outer',
      '->T inner',
        '+T', '+S', '+C',
        '->T'+i+'S1C1',
          '->C outer',
            '+C',
          '<-C outer',
          '->S inner',
            '+S', '+C',
            '->T'+i+'S2C1',
              '->C outer',
                '+C',
              '<-C outer',
            '<-T'+i+'S2C1',
          '<-S inner',
        '<-T'+i+'S1C1',
      '<-T inner',
      '->C inner',
        '->T'+i+'S2C2',
          '->C inner',
            '->T'+i+'S1C2', '<-T'+i+'S1C2',
          '<-C inner',
        '<-T'+i+'S2C2',
      '<-C inner'
    ];
    t.deepEquals(describer.verbose, full, "full trace should match.");
  });
});
