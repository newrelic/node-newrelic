'use strict'

var helper = require('../../../lib/agent_helper')
var assertSegments = require('../../../lib/metrics_helper').assertSegments


module.exports = runTests

function runTests(t, agent, Promise) {
  segmentsEnabledTests(t, agent, Promise, doSomeWork)
  segmentsDisabledTests(t, agent, Promise, doSomeWork)

  // simulates a function that returns a promise and has a segment created for itself
  function doSomeWork(segmentName, shouldReject) {
    var tracer = agent.tracer
    var segment = tracer.createSegment(segmentName)
    return tracer.bindFunction(actualWork, segment)()
    function actualWork() {
      segment.touch()
      return new Promise(function startSomeWork(resolve, reject) {
        if (shouldReject) {
          process.nextTick(function() {
            reject('some reason')
          })
        } else {
          process.nextTick(function() {
            resolve(123)
          })
        }
      })
    }
  }
}

function segmentsEnabledTests(t, agent, Promise, doSomeWork) {
  var tracer = agent.tracer

  t.test('segments: child segment is created inside then handler', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doSomeWork', [
          'Promise startSomeWork', [
            'Promise#then <anonymous>', [
              'someChildSegment'
            ]
          ]
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doSomeWork')
        .then(function() {
          var childSegment = tracer.createSegment('someChildSegment')
          // touch the segment, so that it is not truncated
          childSegment.touch()
          tracer.bindFunction(function() {}, childSegment)
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('segments: then handler that returns a new promise', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doWork1', [
          'Promise startSomeWork', [
            'Promise#then firstThen', [
              'Promise secondChain', [
                'Promise#then secondThen'
              ]
            ]
          ]
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return new Promise(function secondChain(res) { res() })
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('segments: then handler that returns a value', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doWork1',
        [
          'Promise startSomeWork',
          [
            'Promise#then firstThen',
            [
              'Promise#then secondThen',
            ]
          ]
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return 'some value'
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('segments: catch handler with error from original promise', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doWork1',
        [
          'Promise startSomeWork',
          [
            'Promise#catch catchHandler',
          ]
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1', true)
        .then(function firstThen() {
          return 'some value'
        })
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('segments: catch handler with error from subsequent promise', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doWork1',
        [
          'Promise startSomeWork',
          [
            'Promise#then firstThen',
            [
              'doWork2',
              [
                'Promise startSomeWork',
                [
                  'Promise#catch catchHandler'
                ]
              ]
            ]
          ]
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return doSomeWork('doWork2', true)
        })
        .then(function secondThen() {})
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('segments: when promise is created beforehand', function(t) {
    agent.config.feature_flag.promise_segments = true

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 2)

      checkSegments(t, tx.trace.root, [
        'Promise startSomeWork',
        [
          'Promise#then myThen'
        ],
        'doSomeWork'
      ], true)

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      var resolve
      var p = new Promise(function startSomeWork(r){
        resolve = r
      })

      var segment = tracer.createSegment('doSomeWork')
      tracer.bindFunction(doSomeWork, segment)

      p.then(function myThen() {
        segment.touch()
        process.nextTick(transaction.end.bind(transaction))
      })

      // simulate call that resolves the promise, but its segment is created
      // after the promise is created
      function doSomeWork() {
        resolve()
      }

      doSomeWork()
    })
  })
}

function segmentsDisabledTests(t, agent, Promise, doSomeWork) {
  var tracer = agent.tracer

  t.test('no segments: child segment is created inside then handler', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doSomeWork', [
          'someChildSegment'
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doSomeWork')
        .then(function() {
          var childSegment = tracer.createSegment('someChildSegment')
          // touch the segment, so that it is not truncated
          childSegment.touch()
          tracer.bindFunction(function() {}, childSegment)
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('no segments: then handler that returns a new promise', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, ['doWork1'])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return new Promise(function secondChain(res){ res(); })
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('no segments: then handler that returns a value', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, ['doWork1'])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return 'some value'
        })
        .then(function secondThen() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('no segments: catch handler with error from original promise', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, ['doWork1'])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1', true)
        .then(function firstThen() {
          return 'some value'
        })
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('no segments: catch handler with error from subsequent promise', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, [
        'doWork1', [
          'doWork2',
        ]
      ])

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      doSomeWork('doWork1')
        .then(function firstThen() {
          return doSomeWork('doWork2', true)
        })
        .then(function secondThen() {})
        .catch(function catchHandler() {
          process.nextTick(transaction.end.bind(transaction))
        })
    })
  })

  t.test('no segments: when promise is created beforehand', function(t) {
    agent.config.feature_flag.promise_segments = false

    agent.once('transactionFinished', function(tx) {
      t.equal(tx.trace.root.children.length, 1)

      checkSegments(t, tx.trace.root, ['doSomeWork'], true)

      t.end()
    })

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      var resolve
      var p = new Promise(function startSomeWork(r){ resolve = r })

      var segment = tracer.createSegment('doSomeWork')
      tracer.bindFunction(doSomeWork, segment)

      p.then(function myThen() {
        segment.touch()
        process.nextTick(transaction.end.bind(transaction))
      })

      // Simulate call that resolves the promise, but its segment is created
      // after the promise is created.
      function doSomeWork() {
        resolve()
      }

      doSomeWork()
    })
  })
}

function checkSegments(t, parent, expected, options) {
  t.doesNotThrow(function() {
    assertSegments(parent, expected, options)
  }, 'should have expected segments')
}
