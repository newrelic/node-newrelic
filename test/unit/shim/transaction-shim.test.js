'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var TransactionShim = require('../../../lib/shim/transaction-shim')


describe('TransactionShim', function() {
  var agent = null
  var shim = null
  var wrappable = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    shim = new TransactionShim(agent, 'test-module')
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      getActiveSegment: function() {
        return agent.tracer.getSegment()
      }
    }
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  describe('constructor', function() {
    it('should require an agent parameter', function() {
      expect(function() { return new TransactionShim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require a module name parameter', function() {
      expect(function() { return new TransactionShim(agent) })
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })
  })

  describe('#WEB, #BG, #MESSAGE', function() {
    var keys = ['WEB', 'BG', 'MESSAGE']

    it('should be a non-writable property', function() {
      keys.forEach(function(k) {
        testNonWritable(shim, k)
      })
    })

    it('should be transaction types', function() {
      keys.forEach(function(k) {
        expect(shim).to.have.property(k, k.toLowerCase())
      })
    })
  })

  describe('#bindCreateTransaction', function() {
    it('should not wrap non-functions', function() {
      shim.bindCreateTransaction(wrappable, 'name', {type: shim.WEB})
      expect(shim.isWrapped(wrappable.name)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.bindCreateTransaction(wrappable.bar, {type: shim.WEB})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.bindCreateTransaction(wrappable.bar, null, {type: shim.WEB})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.bindCreateTransaction(wrappable, 'bar', {type: shim.WEB})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable, 'bar')).to.be.true
        expect(shim.unwrap(wrappable, 'bar')).to.equal(original)
      })
    })

    describe('wrapper', function() {
      it('should execute the wrapped function', function() {
        var executed = false
        var context = {}
        var value = {}
        var wrapped = shim.bindCreateTransaction(function(a, b, c) {
          executed = true
          expect(this).to.equal(context)
          expect(a).to.equal('a')
          expect(b).to.equal('b')
          expect(c).to.equal('c')
          return value
        }, {type: shim.WEB})

        expect(executed).to.be.false
        var ret = wrapped.call(context, 'a', 'b', 'c')
        expect(executed).to.be.true
        expect(ret).to.equal(value)
      })

      it('should create a transaction with the correct type', function() {
        shim.bindCreateTransaction(wrappable, 'getActiveSegment', {type: shim.WEB})
        var segment = wrappable.getActiveSegment()
        expect(segment)
          .to.exist()
          .and.have.property('transaction')
          .that.has.property('type', shim.WEB)

        shim.unwrap(wrappable, 'getActiveSegment')
        shim.bindCreateTransaction(wrappable, 'getActiveSegment', {type: shim.BG})
        var segment = wrappable.getActiveSegment()
        expect(segment)
          .to.exist()
          .and.have.property('transaction')
          .that.has.property('type', shim.BG)
      })

      describe('when `spec.nest` is false', function() {
        it('should not create a nested transaction', function() {
          var webTx = null
          var bgTx = null
          var webCalled = false
          var bgCalled = false
          var web = shim.bindCreateTransaction(function() {
            webCalled = true
            webTx = shim.getSegment().transaction
            bg()
          }, {type: shim.WEB})

          var bg = shim.bindCreateTransaction(function() {
            bgCalled = true
            bgTx = shim.getSegment().transaction
          }, {type: shim.BG})

          web()
          expect(webCalled).to.be.true
          expect(bgCalled).to.be.true
          expect(webTx).to.exist().and.equal(bgTx)
        })
      })

      describe('when `spec.nest` is `true`', function() {
        var transactions = null
        var web = null
        var bg = null

        beforeEach(function() {
          transactions = []
          web = shim.bindCreateTransaction(function(cb) {
            transactions.push(shim.getSegment().transaction)
            if (cb) {
              cb()
            }
          }, {type: shim.WEB, nest: true})

          bg = shim.bindCreateTransaction(function(cb) {
            transactions.push(shim.getSegment().transaction)
            if (cb) {
              cb()
            }
          }, {type: shim.BG, nest: true})
        })

        it('should create a nested transaction if the types differ', function() {
          web(bg)
          expect(transactions).to.have.lengthOf(2)
          expect(transactions[0]).to.not.equal(transactions[1])

          transactions = []
          bg(web)
          expect(transactions).to.have.lengthOf(2)
          expect(transactions[0]).to.not.equal(transactions[1])
        })

        it('should not create nested transactions if the types are the same', function() {
          web(web)
          expect(transactions).to.have.lengthOf(2)
          expect(transactions[0]).to.equal(transactions[1])

          transactions = []
          bg(bg)
          expect(transactions).to.have.lengthOf(2)
          expect(transactions[0]).to.equal(transactions[1])
        })

        it('should create transactions if the types alternate', function() {
          web(bg.bind(null, web.bind(null, bg)))
          expect(transactions).to.have.lengthOf(4)
          for (var i = 0; i < transactions.length; ++i) {
            var tx1 = transactions[i]
            for (var j = i + 1; j < transactions.length; ++j) {
              var tx2 = transactions[j]
              expect(tx1).to.not.equal(tx2, 'tx ' + i + ' should not equal tx ' + j)
            }
          }
        })
      })
    })
  })
})

function testNonWritable(obj, key, value) {
  expect(function() {
    obj[key] = 'testNonWritable test value'
  }).to.throw(
    TypeError,
    new RegExp('(read only property \'' + key + '\'|Cannot set property ' + key + ')')
  )

  if (value) {
    expect(obj).to.have.property(key, value)
  } else {
    expect(obj).to.have.property(key)
      .that.is.not.equal('testNonWritable test value')
  }
}
