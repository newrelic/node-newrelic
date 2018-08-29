'use strict'

const async = require('async')
const expect = require('chai').expect
const helper = require('../../lib/agent_helper')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')

describe('PromiseShim', () => {
  let agent = null
  let shim = null
  let TestPromise = null

  beforeEach(() => {
    // TODO: Convert this test to use ES6 class after deprecating Node <5.
    TestPromise = function(executor) {
      this.executorCaller(executor)
    }

    TestPromise.resolve = function(val) {
      const p = Object.create(TestPromise.prototype)
      p.resolver(val)
      return p
    }

    TestPromise.reject = function(val) {
      const p = Object.create(TestPromise.prototype)
      p.rejector(val)
      return p
    }

    TestPromise.promisify = function(func) {
      return function() {
        const args = shim.argsToArray.apply(shim, arguments)
        const p = Object.create(TestPromise.prototype)
        args.push((err, res) => {
          if (err) {
            p.rejector(err)
          } else {
            p.resolver(res)
          }
        })
        func.apply(this, args)
        return p
      }
    }

    TestPromise.prototype.executorCaller = function(executor) {
      try {
        executor(this.resolver.bind(this), this.rejector.bind(this))
      } catch (err) {
        this.rejector(err)
      }
    }

    TestPromise.prototype.resolver = function(resolution) {
      this.resolution = resolution
      helper.runOutOfContext(() => {
        if (this._next._thenned) {
          this._next._thenned(resolution)
        }
      })
    }

    TestPromise.prototype.rejector = function(rejection) {
      this.rejection = rejection
      helper.runOutOfContext(() => {
        if (this._next._caught) {
          this._next._caught(rejection)
        }
      })
    }

    TestPromise.prototype.then = function(res, rej) {
      this.res = res
      this.rej = rej

      this._next = Object.create(TestPromise.prototype)
      this._next._thenned = res
      this._next._caught = rej

      return this._next
    }

    TestPromise.prototype.catch = function(ErrorClass, rej) {
      this.ErrorClass = ErrorClass
      this.rej = rej

      this._next = Object.create(TestPromise.prototype)
      this._next._caught = rej || ErrorClass

      return this._next
    }

    TestPromise.Promise = TestPromise

    agent = helper.loadMockedAgent()
    shim = new PromiseShim(agent, 'test-promise', null)
  })

  afterEach(() => {
    helper.unloadAgent(agent)
    TestPromise = null
    agent = null
    shim = null
  })

  it('should inherit from Shim', () => {
    expect(shim).to.be.an.instanceOf(PromiseShim)
      .and.an.instanceOf(Shim)
  })

  describe('constructor', () => {
    it('should require the `agent` parameter', () => {
      expect(() => new PromiseShim())
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require the `moduleName` parameter', () => {
      expect(() => new PromiseShim(agent))
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })
  })

  describe('.Contextualizer', () => {
    it('should be the underlying contextualization class', () => {
      expect(PromiseShim).to.have.property('Contextualizer')
        .that.is.an.instanceOf(Function)
    })
  })

  describe('#logger', () => {
    it('should be a non-writable property', () => {
      expect(() => shim.logger = 'foobar').to.throw()

      expect(shim)
        .to.have.property('logger')
        .that.is.not.equal('foobar')
    })

    it('should be a logger to use with the shim', () => {
      expect(shim.logger).to.have.property('trace')
        .that.is.an.instanceOf(Function)
      expect(shim.logger).to.have.property('debug')
        .that.is.an.instanceOf(Function)
      expect(shim.logger).to.have.property('info')
        .that.is.an.instanceOf(Function)
      expect(shim.logger).to.have.property('warn')
        .that.is.an.instanceOf(Function)
      expect(shim.logger).to.have.property('error')
        .that.is.an.instanceOf(Function)
    })
  })

  describe('#setClass', () => {
    it('should set the class used for instance checks', () => {
      const p = new TestPromise(() => {})
      expect(shim.isPromiseInstance(p)).to.be.false

      shim.setClass(TestPromise)
      expect(shim.isPromiseInstance(p)).to.be.true
    })
  })

  describe('#isPromiseInstance', () => {
    it('should detect if an object is an instance of the instrumented class', () => {
      shim.setClass(TestPromise)
      expect(shim.isPromiseInstance(TestPromise)).to.be.false
      expect(shim.isPromiseInstance(new TestPromise(() => {}))).to.be.true
      expect(shim.isPromiseInstance(new Promise(() => {}))).to.be.false
      expect(shim.isPromiseInstance({})).to.be.false
    })
  })

  describe('#wrapConstructor', () => {
    it('should accept just a class constructor', () => {
      const WrappedPromise = shim.wrapConstructor(TestPromise)
      expect(WrappedPromise).to.not.equal(TestPromise)
      expect(shim.isWrapped(WrappedPromise)).to.be.true

      const p = new WrappedPromise((resolve, reject) => {
        expect(resolve).to.be.a('function')
        expect(reject).to.be.a('function')
        resolve()
      })
      expect(p)
        .to.be.an.instanceOf(WrappedPromise)
        .and.an.instanceOf(TestPromise)

      return p
    })

    it('should accept a nodule and property', () => {
      const testing = {TestPromise}
      shim.wrapConstructor(testing, 'TestPromise')
      expect(testing).to.have.property('TestPromise').not.equal(TestPromise)
      expect(shim.isWrapped(testing.TestPromise)).to.be.true

      const p = new testing.TestPromise((resolve, reject) => {
        expect(resolve).to.be.a('function')
        expect(reject).to.be.a('function')
        resolve()
      })
      expect(p)
        .to.be.an.instanceOf(testing.TestPromise)
        .and.an.instanceOf(TestPromise)

      return p
    })

    describe('wrapper', () => {
      it('should execute the executor', () => {
        return helper.runInTransaction(agent, () => {
          let executed = false

          const WrappedPromise = shim.wrapConstructor(TestPromise)
          const p = new WrappedPromise((resolve) => {
            executed = true
            resolve()
          })

          expect(executed).to.be.true

          return p
        })
      })

      it('should not change resolve values', (done) => {
        helper.runInTransaction(agent, () => {
          const resolution = {}

          const WrappedPromise = shim.wrapConstructor(TestPromise)
          const p = new WrappedPromise((resolve) => {
            resolve(resolution)
          })

          p.then((val) => {
            expect(val).to.equal(resolution)
            done()
          })
        })
      })

      it('should not change reject values', (done) => {
        helper.runInTransaction(agent, () => {
          const rejection = {}

          const WrappedPromise = shim.wrapConstructor(TestPromise)
          const p = new WrappedPromise((resolve, reject) => {
            reject(rejection)
          })

          p.catch((val) => {
            expect(val).to.equal(rejection)
            done()
          })
        })
      })

      it('should capture errors thrown in the executor', (done) => {
        helper.runInTransaction(agent, () => {
          const WrappedPromise = shim.wrapConstructor(TestPromise)

          let p = null
          expect(() => {
            p = new WrappedPromise(() => {
              throw new Error('this should be caught')
            })
          }).to.not.throw()

          p.catch((err) => {
            expect(err)
              .to.be.an.instanceOf(Error)
              .and.have.property('message', 'this should be caught')
            done()
          })
        })
      })

      it('should reinstate lost context', (done) => {
        helper.runInTransaction(agent, (tx) => {
          shim.setClass(TestPromise)
          const WrappedPromise = shim.wrapConstructor(TestPromise)

          // Wrapping then is required to make sure the then callback is wrapped
          // with context propagation.
          shim.wrapThen(TestPromise.prototype, 'then')

          async.series([
            (cb) => {
              expectSameTransaction(agent.getTransaction(), tx)
              new WrappedPromise((resolve) => {
                expectSameTransaction(agent.getTransaction(), tx)
                resolve() // <-- Resolve will lose context.
              }).then(() => {
                expectSameTransaction(agent.getTransaction(), tx)
                cb()
              }).catch(cb)
            },
            (cb) => {
              expectSameTransaction(agent.getTransaction(), tx)
              new WrappedPromise((resolve) => {
                expectSameTransaction(agent.getTransaction(), tx)
                helper.runOutOfContext(resolve) // <-- Context loss before resolve.
              }).then(() => {
                expectSameTransaction(agent.getTransaction(), tx)
                cb()
              }).catch(cb)
            }
          ], done)
        })
      })
    })
  })

  describe('#wrapExecutorCaller', () => {
    it('should accept just a function', () => {
      const wrappedCaller = shim.wrapExecutorCaller(TestPromise.prototype.executorCaller)
      expect(wrappedCaller).to.not.equal(TestPromise.prototype.executorCaller)
      expect(shim.isWrapped(wrappedCaller)).to.be.true

      TestPromise.prototype.executorCaller = wrappedCaller

      const p = new TestPromise((resolve, reject) => {
        expect(resolve).to.be.a('function')
        expect(reject).to.be.a('function')
        resolve()
      })
      expect(p).an.instanceOf(TestPromise)

      return p
    })

    it('should accept a nodule and property', () => {
      shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
      expect(shim.isWrapped(TestPromise.prototype.executorCaller)).to.be.true

      const p = new TestPromise((resolve, reject) => {
        expect(resolve).to.be.a('function')
        expect(reject).to.be.a('function')
        resolve()
      })
      expect(p).an.instanceOf(TestPromise)

      return p
    })

    describe('wrapper', () => {
      it('should execute the executor', () => {
        return helper.runInTransaction(agent, () => {
          let executed = false

          shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
          const p = new TestPromise((resolve) => {
            executed = true
            resolve()
          })

          expect(executed).to.be.true

          return p
        })
      })

      it('should not change resolve values', (done) => {
        helper.runInTransaction(agent, () => {
          const resolution = {}

          shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
          const p = new TestPromise((resolve) => {
            resolve(resolution)
          })

          p.then((val) => {
            expect(val).to.equal(resolution)
            done()
          })
        })
      })

      it('should not change reject values', (done) => {
        helper.runInTransaction(agent, () => {
          const rejection = {}

          shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')
          const p = new TestPromise((resolve, reject) => {
            reject(rejection)
          })

          p.catch((val) => {
            expect(val).to.equal(rejection)
            done()
          })
        })
      })

      it('should capture errors thrown in the executor', (done) => {
        helper.runInTransaction(agent, () => {
          shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

          let p = null
          expect(() => {
            p = new TestPromise(() => {
              throw new Error('this should be caught')
            })
          }).to.not.throw()

          p.catch((err) => {
            expect(err)
              .to.be.an.instanceOf(Error)
              .and.have.property('message', 'this should be caught')
            done()
          })
        })
      })

      it('should reinstate lost context', (done) => {
        helper.runInTransaction(agent, (tx) => {
          shim.setClass(TestPromise)
          shim.wrapExecutorCaller(TestPromise.prototype, 'executorCaller')

          // Wrapping then is required to make sure the then callback is wrapped
          // with context propagation.
          shim.wrapThen(TestPromise.prototype, 'then')

          async.series([
            (cb) => {
              expectSameTransaction(agent.getTransaction(), tx)
              new TestPromise((resolve) => {
                expectSameTransaction(agent.getTransaction(), tx)
                resolve() // <-- Resolve will lose context.
              }).then(() => {
                expectSameTransaction(agent.getTransaction(), tx)
                cb()
              }).catch(cb)
            },
            (cb) => {
              expectSameTransaction(agent.getTransaction(), tx)
              new TestPromise((resolve) => {
                expectSameTransaction(agent.getTransaction(), tx)
                helper.runOutOfContext(resolve) // <-- Context loss before resolve.
              }).then(() => {
                expectSameTransaction(agent.getTransaction(), tx)
                cb()
              }).catch(cb)
            }
          ], done)
        })
      })
    })
  })

  describe('#wrapCast', () => {
    it('should accept just a function', (done) => {
      const wrappedResolve = shim.wrapCast(TestPromise.resolve)
      expect(wrappedResolve)
        .to.be.a('function')
        .and.not.equal(TestPromise.resolve)
      expect(shim.isWrapped(wrappedResolve)).to.be.true

      const p = wrappedResolve('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      p.then((val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    it('should accept a nodule and property', (done) => {
      shim.wrapCast(TestPromise, 'resolve')
      expect(TestPromise.resolve).to.be.a('function')
      expect(shim.isWrapped(TestPromise.resolve)).to.be.true

      const p = TestPromise.resolve('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      p.then((val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    describe('wrapper', () => {
      it('should link context through to thenned callbacks', (done) => {
        shim.setClass(TestPromise)
        shim.wrapCast(TestPromise, 'resolve')
        shim.wrapThen(TestPromise.prototype, 'then')

        helper.runInTransaction(agent, (tx) => {
          TestPromise.resolve().then(() => {
            expectSameTransaction(agent.getTransaction(), tx)
            done()
          })
        })
      })
    })
  })

  describe('#wrapThen', () => {
    it('should accept just a function', (done) => {
      shim.setClass(TestPromise)
      const wrappedThen = shim.wrapThen(TestPromise.prototype.then)
      expect(wrappedThen)
        .to.be.a('function')
        .and.not.equal(TestPromise.prototype.then)
      expect(shim.isWrapped(wrappedThen)).to.be.true

      const p = TestPromise.resolve('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      wrappedThen.call(p, (val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    it('should accept a nodule and property', (done) => {
      shim.setClass(TestPromise)
      shim.wrapThen(TestPromise.prototype, 'then')
      expect(TestPromise.prototype.then).to.be.a('function')
      expect(shim.isWrapped(TestPromise.prototype.then)).to.be.true

      const p = TestPromise.resolve('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      p.then((val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    describe('wrapper', () => {
      it('should link context through to thenned callbacks', (done) => {
        shim.setClass(TestPromise)
        shim.wrapThen(TestPromise.prototype, 'then')

        helper.runInTransaction(agent, (tx) => {
          TestPromise.resolve().then(() => {
            expectSameTransaction(agent.getTransaction(), tx)
            done()
          })
        })
      })

      it('should wrap both handlers', () => {
        shim.setClass(TestPromise)
        shim.wrapThen(TestPromise.prototype, 'then')

        const p = TestPromise.resolve()
        p.then(resolve, reject)

        expect(p).property('res').to.be.a('function').and.not.equal(resolve)
        expect(p).property('rej').to.be.a('function').and.not.equal(reject)

        function resolve() {}
        function reject() {}
      })
    })
  })

  describe('#wrapCatch', () => {
    it('should accept just a function', (done) => {
      shim.setClass(TestPromise)
      const wrappedCatch = shim.wrapCatch(TestPromise.prototype.catch)
      expect(wrappedCatch)
        .to.be.a('function')
        .and.not.equal(TestPromise.prototype.catch)
      expect(shim.isWrapped(wrappedCatch)).to.be.true

      const p = TestPromise.reject('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      wrappedCatch.call(p, (val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    it('should accept a nodule and property', (done) => {
      shim.setClass(TestPromise)
      shim.wrapCatch(TestPromise.prototype, 'catch')
      expect(TestPromise.prototype.catch).to.be.a('function')
      expect(shim.isWrapped(TestPromise.prototype.catch)).to.be.true

      const p = TestPromise.reject('foo')
      expect(p).to.be.an.instanceOf(TestPromise)
      p.catch((val) => {
        expect(val).to.equal('foo')
        done()
      })
    })

    describe('wrapper', () => {
      it('should link context through to thenned callbacks', (done) => {
        shim.setClass(TestPromise)
        shim.wrapCatch(TestPromise.prototype, 'catch')

        helper.runInTransaction(agent, (tx) => {
          TestPromise.reject().catch(() => {
            expectSameTransaction(agent.getTransaction(), tx)
            done()
          })
        })
      })

      it('should only wrap the rejection handler', () => {
        shim.setClass(TestPromise)
        shim.wrapCatch(TestPromise.prototype, 'catch')

        const p = TestPromise.reject()
        p.catch(Error, reject)

        expect(p).property('ErrorClass', Error)
        expect(p).property('rej').to.be.a('function').and.not.equal(reject)

        function reject() {}
      })
    })
  })

  describe('#wrapPromisify', () => {
    let asyncFn = null

    beforeEach(() => {
      asyncFn = (val, cb) => {
        helper.runOutOfContext(() => {
          if (val instanceof Error) {
            cb(val)
          } else {
            cb(null, val)
          }
        })
      }
    })

    it('should accept just a function', () => {
      const wrappedPromisify = shim.wrapPromisify(TestPromise.promisify)
      expect(wrappedPromisify)
        .to.be.a('function')
        .and.not.equal(TestPromise.promisify)
      expect(shim.isWrapped(wrappedPromisify)).to.be.true

      const promised = wrappedPromisify(asyncFn)
      expect(promised)
        .to.be.a('function')
        .and.not.equal(asyncFn)
    })

    it('should accept a nodule and property', () => {
      shim.wrapPromisify(TestPromise, 'promisify')
      expect(TestPromise.promisify).to.be.a('function')
      expect(shim.isWrapped(TestPromise.promisify)).to.be.true

      const promised = TestPromise.promisify(asyncFn)
      expect(promised)
        .to.be.a('function')
        .and.not.equal(asyncFn)
    })

    describe('wrapper', () => {
      it('should propagate transaction context', (done) => {
        shim.setClass(TestPromise)
        shim.wrapPromisify(TestPromise, 'promisify')
        shim.wrapThen(TestPromise.prototype, 'then')

        const promised = TestPromise.promisify(asyncFn)

        helper.runInTransaction(agent, (tx) => {
          promised('foobar').then((val) => {
            expectSameTransaction(agent.getTransaction(), tx)
            expect(val).to.equal('foobar')
            done()
          })
        })
      })
    })
  })
})

function expectSameTransaction(tx1, tx2) {
  expect(tx2, 'transaction 2').to.exist
  expect(tx1, 'transaction 1').to.exist.and.have.property('id', tx2.id)
}
