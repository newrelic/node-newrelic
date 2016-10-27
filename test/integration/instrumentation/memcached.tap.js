'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var findSegment = require('../../lib/metrics_helper').findSegment
var getMetricHostName = require('../../lib/metrics_helper').getMetricHostName
var util = require('util')


var METRICS_ASSERTIONS = 10

test('memcached instrumentation', {timeout : 5000}, function(t) {
  t.autoend()

  var agent
  var Memcached
  var memcached
  var HOST_ID

  t.test('generates correct metrics and trace segments', function(t) {
    t.autoend()

    t.beforeEach(function(done) {
      helper.bootstrapMemcached(function cb_bootstrapMemcached(error) {
        if (error) {
          return done(error)
        }
        agent = helper.instrumentMockedAgent()

        Memcached = require('memcached')
        memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)

        HOST_ID = getMetricHostName(agent, 'memcached') + '/' + params.memcached_port

        done()
      })
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      memcached.end()
      done()
    })

    t.test('touch()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.touch('foo', 1, function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/touch'
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/touch': 1
            })
          })
        })
      })
    })

    t.test('get()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/get',
              [
                'Truncated/Callback: anonymous'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/get': 1
            })
          })
        })
      })
    })

    t.test('gets()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.gets('foo', function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/gets',
              [
                'Truncated/Callback: anonymous'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/gets': 1
            })
          })
        })
      })
    })

    t.test('getMulti()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.getMulti(['foo', 'bar'], function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/get',
              [
                'Truncated/Callback: handle'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/get': 1
            })
          })
        })
      })
    })

    t.test('set()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/set',
              [
                'Truncated/Callback: anonymous'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/set': 1
            })
          })
        })
      })
    })

    t.test('replace()', function(t) {
      t.plan(3 + METRICS_ASSERTIONS)

      memcached.set('foo', 'bar', 10, function(err) {
        t.notOk(err, 'should not throw error')

        helper.runInTransaction(agent, function transactionInScope(transaction) {
          memcached.replace('foo', 'new', 10, function(err) {
            t.notOk(err, 'should not throw an error')
            t.ok(agent.getTransaction(), 'transaction should still be visible')

            transaction.end(function() {
              verifySegments(t, transaction.trace.root, [
                'Datastore/operation/Memcache/replace',
              [
                'Truncated/Callback: anonymous'
              ]
              ])

              verifyMetrics(t, transaction.metrics, {
                'Datastore/all': 1,
                'Datastore/allOther': 1,
                'Datastore/Memcache/all': 1,
                'Datastore/Memcache/allOther': 1,
                'Datastore/operation/Memcache/replace': 1
              })
            })
          })
        })
      })
    })

    t.test('add()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.add('foo', 'bar', 10, function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/add',
              [
                'Truncated/Callback: anonymous'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/add': 1
            })
          })
        })
      })
    })

    t.test('cas()', function(t) {
      t.plan(4 + METRICS_ASSERTIONS)

      memcached.set('foo', 'bar', 10, function(err) {
        t.notOk(err, 'set should not have errored')

        memcached.gets('foo', function(err, data) {
          t.notOk(err, 'gets should not have errored')

          helper.runInTransaction(agent, function transactionInScope(transaction) {
            memcached.cas('foo', 'bar', data.cas, 10, function(err) {
              t.notOk(err, 'should not throw an error')
              t.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end(function() {
                verifySegments(t, transaction.trace.root, [
                  'Datastore/operation/Memcache/cas',
                  [
                    'Truncated/Callback: anonymous'
                  ]
                ])

                verifyMetrics(t, transaction.metrics, {
                  'Datastore/all': 1,
                  'Datastore/allOther': 1,
                  'Datastore/Memcache/all': 1,
                  'Datastore/Memcache/allOther': 1,
                  'Datastore/operation/Memcache/cas': 1
                })
              })
            })
          })
        })
      })
    })

    t.test('append()', function(t) {
      t.plan(3 + METRICS_ASSERTIONS)

      memcached.set('foo', 'bar', 10, function(err) {
        t.error(err)
        helper.runInTransaction(agent, function(transaction) {
          memcached.append('foo', 'bar', function(err) {
            t.error(err)
            t.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end(function() {
              verifySegments(t, transaction.trace.root, [
                'Datastore/operation/Memcache/append', [
                  'Truncated/Callback: anonymous'
                ]
              ])

              verifyMetrics(t, transaction.metrics, {
                'Datastore/all': 1,
                'Datastore/allOther': 1,
                'Datastore/Memcache/all': 1,
                'Datastore/Memcache/allOther': 1,
                'Datastore/operation/Memcache/append': 1
              })
            })
          })
        })
      })
    })

    t.test('prepend()', function(t) {
      t.plan(3 + METRICS_ASSERTIONS)

      memcached.set('foo', 'bar', 10, function(err) {
        t.error(err)
        helper.runInTransaction(agent, function(transaction) {
          memcached.prepend('foo', 'bar', function(err) {
            t.error(err)
            t.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end(function() {
              verifySegments(t, transaction.trace.root, [
                'Datastore/operation/Memcache/prepend', [
                  'Truncated/Callback: anonymous'
                ]
              ])

              verifyMetrics(t, transaction.metrics, {
                'Datastore/all': 1,
                'Datastore/allOther': 1,
                'Datastore/Memcache/all': 1,
                'Datastore/Memcache/allOther': 1,
                'Datastore/operation/Memcache/prepend': 1
              })
            })
          })
        })
      })
    })

    t.test('del()', function(t) {
      t.plan(3 + METRICS_ASSERTIONS)

      memcached.set('foo', 'bar', 10, function(err) {
        t.error(err)
        helper.runInTransaction(agent, function(transaction) {
          memcached.del('foo', function(err) {
            t.error(err)
            t.ok(agent.getTransaction(), 'transaction should still be visible')
            transaction.end(function() {
              verifySegments(t, transaction.trace.root, [
                'Datastore/operation/Memcache/delete', [
                  'Truncated/Callback: anonymous'
                ]
              ])

              verifyMetrics(t, transaction.metrics, {
                'Datastore/all': 1,
                'Datastore/allOther': 1,
                'Datastore/Memcache/all': 1,
                'Datastore/Memcache/allOther': 1,
                'Datastore/operation/Memcache/delete': 1
              })
            })
          })
        })
      })
    })

    t.test('incr()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.incr('foo', 10, function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/incr',
              [
                'Truncated/Callback: anonymous'
              ]
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/incr': 1
            })
          })
        })
      })
    })

    t.test('decr()', function(t) {
      t.plan(2 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.decr('foo', 10, function(err) {
          t.notOk(err, 'should not throw an error')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/decr'
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/decr': 1
            })
          })
        })
      })
    })

    // memcached.version() is one of the calls that gets the second argument to
    // command.
    t.test("version()", function(t) {
      t.plan(3 + METRICS_ASSERTIONS)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.version(function (err, ok) {
          t.notOk(err, 'should not throw an error')
          t.ok(ok, 'got a version')
          t.ok(agent.getTransaction(), 'transaction should still be visible')

          transaction.end(function() {
            verifySegments(t, transaction.trace.root, [
              'Datastore/operation/Memcache/version'
            ])

            verifyMetrics(t, transaction.metrics, {
              'Datastore/all': 1,
              'Datastore/allOther': 1,
              'Datastore/Memcache/all': 1,
              'Datastore/Memcache/allOther': 1,
              'Datastore/operation/Memcache/version': 1
            })
          })
        })
      })
    })
  })

  t.test('captures parameters', function(t) {
    t.autoend()

    t.beforeEach(function(done) {
      helper.bootstrapMemcached(function cb_bootstrapMemcached(error) {
        if (error) {
          return done(error)
        }
        agent = helper.instrumentMockedAgent()

        // capture parameters
        agent.config.capture_params = true

        Memcached = require('memcached')
        memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
        done()
      })
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      memcached.end()
      done()
    })

    t.test('get()', function(t) {
      t.plan(2)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(segment.parameters.key, "\"foo\"",
                     "should have the get key as a parameter")
          })
        })
      })
    })

    t.test('getMulti()', function(t) {
      t.plan(2)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.getMulti(['foo', 'bar'], function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(segment.parameters.key, "[\"foo\",\"bar\"]",
                     "should have the multiple keys fetched as a parameter")
          })
        })
      })
    })

    t.test('set()', function(t) {
      t.plan(2)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(segment.parameters.key, "\"foo\"",
                     "should have the set key as a parameter")
          })
        })
      })
    })
  })

  t.test('captures datastore instance parameters', function(t) {
    t.autoend()

    t.beforeEach(function(done) {
      helper.bootstrapMemcached(function cb_bootstrapMemcached(error) {
        if (error) {
          return done(error)
        }
        agent = helper.instrumentMockedAgent()

        Memcached = require('memcached')
        memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
        done()
      })
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      memcached.end()
      done()
    })

    t.test('get()', function(t) {
      t.plan(5)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(
              segment.parameters.host,
              getMetricHostName(agent, 'memcached'),
              'should collect host instance parameters'
            )
            t.equals(
              segment.parameters.port_path_or_id,
              String(params.memcached_port),
              'should collect port instance parameters'
            )

            var expectedMetrics = {}
            expectedMetrics['Datastore/instance/Memcache/' + HOST_ID] = 1
            verifyMetrics(t, transaction.metrics, expectedMetrics)
          })
        })
      })
    })

    t.test('set()', function(t) {
      t.plan(5)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(
              segment.parameters.host,
              getMetricHostName(agent, 'memcached'),
              'should collect host instance parameters'
            )
            t.equals(
              segment.parameters.port_path_or_id,
              String(params.memcached_port),
              'should collect port instance parameters'
            )

            var expectedMetrics = {}
            expectedMetrics['Datastore/instance/Memcache/' + HOST_ID] = 1
            verifyMetrics(t, transaction.metrics, expectedMetrics)
          })
        })
      })
    })
  })

  t.test('does not capture datastore instance parameters when disabled', function(t) {
    t.autoend()

    t.beforeEach(function(done) {
      helper.bootstrapMemcached(function cb_bootstrapMemcached(error) {
        if (error) {
          return done(error)
        }
        agent = helper.instrumentMockedAgent()

        // disable
        agent.config.datastore_tracer.instance_reporting.enabled = false

        Memcached = require('memcached')
        memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
        done()
      })
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      memcached.end()
      done()
    })

    t.test('get()', function(t) {
      t.plan(4)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.get('foo', function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(
              segment.parameters.host,
              undefined,
              'should not have host instance parameter'
            )
            t.equals(
              segment.parameters.port_path_or_id,
              undefined,
              'should should not have port instance parameter'
            )

            var datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
            t.notOk(agent.metrics.unscoped[datastoreInstanceMetric],
              'should not have datastore instance metric')
          })
        })
      })
    })

    t.test('set()', function(t) {
      t.plan(4)

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        memcached.set('foo', 'bar', 10, function(err) {
          t.notOk(err, 'should not throw an error')

          transaction.end(function() {
            var segment = transaction.trace.root.children[0]
            t.equals(
              segment.parameters.host,
              undefined,
              'should not have host instance parameter'
            )
            t.equals(
              segment.parameters.port_path_or_id,
              undefined,
              'should should not have port instance parameter'
            )

            var datastoreInstanceMetric = 'Datastore/instance/Memcache/' + HOST_ID
            t.notOk(agent.metrics.unscoped[datastoreInstanceMetric],
              'should not have datastore instance metric')
          })
        })
      })
    })
  })

  t.test('captures datastore instance parameters with multiple hosts', function(t) {
    t.autoend()
    var origCommand = null
    var realServer = params.memcached_host + ':' + params.memcached_port

    t.beforeEach(function(done) {
      helper.bootstrapMemcached(function(error) {
        if (error) {
          return done(error)
        }

        // Load memcached and replace the command func with our own that will
        // use a real server address.
        Memcached = require('memcached')
        origCommand = Memcached.prototype.command
        /* eslint-disable no-unused-vars */
        Memcached.prototype.command = function stubbedCommand(queryCompiler, server) {
          /* eslint-enable no-unused-vars */
          origCommand.call(this, queryCompiler, realServer)
        }

        // Then load the agent and reload memcached to ensure it gets instrumented.
        agent = helper.instrumentMockedAgent()
        Memcached = require('memcached')
        memcached = new Memcached(['server1:1111', 'server2:2222'])

        // Finally, change the hashring to something controllable.
        memcached.HashRing.get = function(key) {
          return key === 'foo' ? 'server1:1111' : 'server2:2222'
        }

        done()
      })
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      memcached.end()
      if (origCommand) {
        Memcached.prototype.command = origCommand
      }
      done()
    })

    function checkParams(segment, host, port) {
      t.equals(
        segment.parameters.host, host,
        'should have correct host (' + host + ')'
      )
      t.equals(
        segment.parameters.port_path_or_id, port,
        'should have correct port (' + port + ')'
      )
    }

    t.test('separate gets', function(t) {
      helper.runInTransaction(agent, function(transaction) {
        memcached.get('foo', function(err) {
          if (!t.error(err)) {
            return t.end()
          }
          var firstSegment = agent.tracer.getSegment().parent

          memcached.get('bar', function(err) {
            if (!t.error(err)) {
              return t.end()
            }
            end(firstSegment, agent.tracer.getSegment().parent)
          })
        })

        function end(firstGet, secondGet) {
          transaction.end(function() {
            t.comment('get foo')
            checkParams(firstGet, 'server1', '1111')

            t.comment('get bar')
            checkParams(secondGet, 'server2', '2222')

            t.end()
          })
        }
      })
    })

    t.test('multi-get', function(t) {
      helper.runInTransaction(agent, function(transaction) {
        memcached.getMulti(['foo', 'bar'], function(err) {
          if (!t.error(err)) {
            return t.end()
          }

          var firstGet = transaction.trace.root.children[0]
          var secondGet = transaction.trace.root.children[1]
          if (firstGet.parameters.host === 'server1') {
            t.comment('first get is server 1')
            checkParams(firstGet, 'server1', '1111')
            checkParams(secondGet, 'server2', '2222')
          } else {
            t.comment('first get is not server 1')
            checkParams(secondGet, 'server1', '1111')
            checkParams(firstGet, 'server2', '2222')
          }
          t.end()
        })
      })
    })
  })
})


function verifySegments(t, rootSegment, expected) {
  var previous
  for (var i = 0; i < expected.length; i++) {
    var child = expected[i]
    if (typeof child === 'string') {
      var childSegment = findSegment(rootSegment, child)
      if (!childSegment) {
        previous = null
        t.fail(util.format('Segment %s does not have child %s', rootSegment.name,
          child))
      } else {
        previous = childSegment
      }
    } else if (child && Array.isArray(child)) {
      verifySegments(t, previous, child)
    }
  }
}

function verifyMetrics(t, metrics, expected) {
  var unscoped = metrics.unscoped
  var expectedNames = Object.keys(expected)
  var unscopedNames = Object.keys(unscoped)

  expectedNames.forEach(function(name) {
    t.ok(unscoped[name], 'should have unscoped metric ' + name)
    t.equals(
      unscoped[name].callCount, expected[name],
      'metric ' + name + ' should have correct callCount'
    )
  })
}
