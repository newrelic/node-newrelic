'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var logger = require('../../lib/logger')
                     .child({component: 'TEST'})
var shimmer = require('../../lib/shimmer')
var EventEmitter = require('events').EventEmitter


describe("the instrumentation injector", function () {
  var nodule = {
    c: 2,
    ham: 'ham',
    doubler: function (x, cb) {
      cb(this.c + x * 2)
    },
    tripler: function (y, cb) {
      cb(this.c + y * 3)
    },
    hammer: function (h, cb) {
      cb(this.ham + h)
    }
  }

  it("should wrap a method", function () {
    var doubled = 0
    var before = false
    var after = false

    shimmer.wrapMethod(nodule, 'nodule', 'doubler', function (original) {
      return function () {
        before = true
        original.apply(this, arguments)
        after = true
      }
    })

    expect(nodule.doubler.__NR_unwrap).a('function')

    nodule.doubler(7, function(z) { doubled = z; })

    expect(doubled).equal(16)
    expect(before).equal(true)
    expect(after).equal(true)
  })

  describe("with accessor replacement", function () {
    var simple

    beforeEach(function () {
      simple = {target: true}
    })

    it("shouldn't throw if called with no params", function () {
      expect(function () {
        shimmer.wrapDeprecated()
      }).not.throws()
    })

    it("shouldn't throw if called with only the original object", function () {
      expect(function () {
        shimmer.wrapDeprecated(simple)
      }).not.throws()
    })

    it("shouldn't throw if property to be replaced is omitted", function () {
      expect(function () {
        shimmer.wrapDeprecated(simple, 'nodule', null,
                               {get: function () {}, set: function () {}})
      }).not.throws()
    })

    it("shouldn't throw if getter is omitted", function () {
      expect(function () {
        shimmer.wrapDeprecated(simple, 'nodule', 'target', {set: function () {}})
      }).not.throws()
    })

    it("shouldn't throw if setter is omitted", function () {
      expect(function () {
        shimmer.wrapDeprecated(simple, 'nodule', 'target', {get: function () {}})
      }).not.throws()
    })

    it("should replace a property with an accessor", function (done) {
      var original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
        get: function () {
          // test will only complete if this is called
          done()
          return false
        }
      })
      expect(original).equal(true)

      expect(simple.target).equal(false)
    })

    it("should invoke the setter when the accessor is used", function (done) {
      var test = 'ham'
      var original = shimmer.wrapDeprecated(simple, 'nodule', 'target', {
        get: function () {
          return test
        },
        set: function (value) {
          expect(value).equal('eggs')
          done()
        }
      })
      expect(original).equal(true)
      expect(simple.target).equal('ham')
      simple.target = 'eggs'
    })
  })

  it("should wrap, then unwrap a method", function () {
    var tripled = 0
    var before = false
    var after = false

    shimmer.wrapMethod(nodule, 'nodule', 'tripler', function (original) {
      return function () {
        before = true
        original.apply(this, arguments)
        after = true
      }
    })

    nodule.tripler(7, function(z) { tripled = z; })

    expect(tripled).equal(23)
    expect(before).equal(true)
    expect(after).equal(true)

    before = false
    after = false

    shimmer.unwrapMethod(nodule, 'nodule', 'tripler')

    nodule.tripler(9, function(j) { tripled = j; })

    expect(tripled).equal(29)
    expect(before).equal(false)
    expect(after).equal(false)
  })

  it("shouldn't break anything when an NR-wrapped method is wrapped again", function () {
    var hamceptacle = ''
    var before = false
    var after = false
    var hammed = false

    shimmer.wrapMethod(nodule, 'nodule', 'hammer', function (original) {
      return function () {
        before = true
        original.apply(this, arguments)
        after = true
      }
    })

    // monkey-patching the old-fashioned way
    var hammer = nodule.hammer
    nodule.hammer = function () {
      hammer.apply(this, arguments)
      hammed = true
    }

    nodule.hammer('Burt', function (k) { hamceptacle = k; })

    expect(hamceptacle).equal('hamBurt')
    expect(before).equal(true)
    expect(after).equal(true)
    expect(hammed).equal(true)
  })

  describe("with full instrumentation running", function () {
    var agent

    beforeEach(function () {
      agent = helper.loadMockedAgent()
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("should push transactions through process.nextTick", function (done) {
      expect(agent.getTransaction()).equal(null)

      var synchronizer = new EventEmitter()
      var transactions = []
      var ids = []


      var spamTransaction = function (i) {
        var wrapped = agent.tracer.transactionProxy(function cb_transactionProxy() {
          var current = agent.getTransaction()
          transactions[i] = current
          ids[i] = current.id

          process.nextTick(agent.tracer.bindFunction(function cb_bindFunction() {
            var lookup = agent.getTransaction()
            expect(lookup).equal(current)

            synchronizer.emit('inner', lookup, i)
          }))
        })
        wrapped()
      }

      var doneCount = 0
      synchronizer.on('inner', function (trans, j) {
        doneCount += 1
        expect(trans).equal(transactions[j])
        expect(trans.id).equal(ids[j])

        trans.end()

        if (doneCount === 10) return done()
      })

      for (var i = 0; i < 10; i += 1) {
        process.nextTick(spamTransaction.bind(this, i))
      }
    })

    it("should push transactions through setTimeout", function (done) {
      expect(agent.getTransaction()).equal(null)

      var synchronizer = new EventEmitter()
      var transactions = []
      var ids = []


      var spamTransaction = function (i) {
        var wrapped = agent.tracer.transactionProxy(function cb_transactionProxy() {
          var current = agent.getTransaction()
          transactions[i] = current
          ids[i] = current.id

          setTimeout(agent.tracer.bindFunction(function cb_bindFunction() {
            var lookup = agent.getTransaction()
            expect(lookup).equal(current)

            synchronizer.emit('inner', lookup, i)
          }), 1)
        })
        wrapped()
      }

      var doneCount = 0
      synchronizer.on('inner', function (trans, j) {
        doneCount += 1
        expect(trans).equal(transactions[j])
        expect(trans.id).equal(ids[j])

        trans.end()

        if (doneCount === 10) return done()
      })

      for (var i = 0; i < 10; i += 1) {
        // You know what this test needs? Some non-determinism!
        var timeout = Math.floor(Math.random() * 20)
        setTimeout(spamTransaction.bind(this, i), timeout)
      }
    })

    it("should push transactions through EventEmitters", function (done) {
      expect(agent.getTransaction()).equal(null)

      var eventer = new EventEmitter()
      var transactions = []
      var ids = []


      var eventTransaction = function (j) {
        var wrapped = agent.tracer.transactionProxy(function cb_transactionProxy() {
          var current = agent.getTransaction()
          var id = current.id
          var name = ('ttest' + (j + 1))


          transactions[j] = current
          ids[j] = id

          eventer.on(name, agent.tracer.bindFunction(function cb_bindFunction() {
            var lookup = agent.getTransaction()
            expect(lookup).equal(current)
            expect(lookup.id).equal(id)

            eventer.emit('inner', lookup, j)
          }))

          eventer.emit(name)
        })
        wrapped()
      }

      var doneCount = 0
      eventer.on('inner', function (trans, j) {
        doneCount += 1
        expect(trans).equal(transactions[j])
        expect(trans.id).equal(ids[j])

        trans.end()

        if (doneCount === 10) return done()
      })

      for (var i = 0; i < 10; i += 1) {
        eventTransaction(i)
      }
    })

    it("should handle whatever ridiculous nonsense you throw at it", function (done) {
      expect(agent.getTransaction()).equal(null)

      var synchronizer = new EventEmitter()
      var eventer = new EventEmitter()
      var transactions = []
      var ids = []
      var doneCount = 0


      var verify = function (i, phase, passed) {
        var lookup = agent.getTransaction()
        logger.trace("%d %s %d %d", i, phase,
                     (lookup ? lookup.id : 'missing'),
                     (passed ? passed.id : 'missing'))
        expect(lookup).equal(passed)
        expect(lookup).equal(transactions[i])
        expect(lookup.id).equal(ids[i])
      }

      eventer.on('rntest', function(trans, j) {
        verify(j, 'eventer', trans)
        synchronizer.emit('inner', trans, j)
      })

      var createTimer = function (trans, j) {
        var wrapped = agent.tracer.wrapFunctionFirst('createTimer', null, process.nextTick)

        wrapped(function() {
          var current = agent.getTransaction()

          verify(j, 'createTimer', current)
          eventer.emit('rntest', current, j)
        })
      }

      var createTicker = function (j) {
        return agent.tracer.transactionProxy(function cb_transactionProxy() {
          var current = agent.getTransaction()
          transactions[j] = current
          ids[j] = current.id

          verify(j, 'createTicker', current)

          process.nextTick(agent.tracer.bindFunction(function cb_bindFunction() {
            verify(j, 'nextTick', current)
            createTimer(current, j)
          }))
        })
      }

      synchronizer.on('inner', function (trans, j) {
        verify(j, 'synchronizer', trans)
        doneCount += 1
        expect(trans).equal(transactions[j])
        expect(trans.id).equal(ids[j])

        trans.end()

        if (doneCount === 10) return done()
      })

      for (var i = 0; i < 10; i++) {
        process.nextTick(createTicker(i))
      }
    })
  })
})
