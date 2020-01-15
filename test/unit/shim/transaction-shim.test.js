'use strict'

var chai = require('chai')
var expect = chai.expect
var hashes = require('../../../lib/util/hashes')
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

    var params = {
      encoding_key: 'this is an encoding key',
      cross_process_id: '1234#4321'
    }
    agent.config.trusted_account_ids = [9876, 6789]
    agent.config._fromServer(params, 'encoding_key')
    agent.config._fromServer(params, 'cross_process_id')
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
    const notRunningStates = ['stopped', 'stopping', 'errored']

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
        expect(segment).to.exist.and.have.nested.property('transaction.type', shim.WEB)

        shim.unwrap(wrappable, 'getActiveSegment')
        shim.bindCreateTransaction(wrappable, 'getActiveSegment', {type: shim.BG})
        var segment = wrappable.getActiveSegment()
        expect(segment).to.exist.and.have.nested.property('transaction.type', shim.BG)
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
          expect(webTx).to.equal(bgTx)
        })

        notRunningStates.forEach((agentState) => {
          it(`should not create transaction when agent state is ${agentState}`, () => {
            agent.setState(agentState)

            let callbackCalled = false
            let transaction = null
            const wrapped = shim.bindCreateTransaction(() => {
              callbackCalled = true
              transaction = shim.tracer.getTransaction()
            }, {type: shim.BG})

            wrapped()

            expect(callbackCalled).to.be.true
            expect(transaction).to.be.null
          })
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

        notRunningStates.forEach((agentState) => {
          it(`should not create transaction when agent state is ${agentState}`, () => {
            agent.setState(agentState)

            let callbackCalled = false
            let transaction = null
            const wrapped = shim.bindCreateTransaction(() => {
              callbackCalled = true
              transaction = shim.tracer.getTransaction()
            }, {type: shim.BG, nest: true})

            wrapped()

            expect(callbackCalled).to.be.true
            expect(transaction).to.be.null
          })
        })
      })
    })
  })

  describe('#pushTransactionName', function() {
    it('should not fail when called outside of a transaction', function() {
      expect(function() {
        shim.pushTransactionName('foobar')
      }).to.not.throw()
    })

    it('should append the given string to the name state stack', function() {
      helper.runInTransaction(agent, function(tx) {
        shim.pushTransactionName('foobar')
        expect(tx.nameState.getName()).to.equal('/foobar')
      })
    })
  })

  describe('#popTransactionName', function() {
    it('should not fail when called outside of a transaction', function() {
      expect(function() {
        shim.popTransactionName('foobar')
      }).to.not.throw()
    })

    it('should pop to the given string in the name state stack', function() {
      helper.runInTransaction(agent, function(tx) {
        shim.pushTransactionName('foo')
        shim.pushTransactionName('bar')
        shim.pushTransactionName('bazz')
        expect(tx.nameState.getName()).to.equal('/foo/bar/bazz')

        shim.popTransactionName('bar')
        expect(tx.nameState.getName()).to.equal('/foo')
      })
    })

    it('should pop just the last item if no string is given', function() {
      helper.runInTransaction(agent, function(tx) {
        shim.pushTransactionName('foo')
        shim.pushTransactionName('bar')
        shim.pushTransactionName('bazz')
        expect(tx.nameState.getName()).to.equal('/foo/bar/bazz')

        shim.popTransactionName()
        expect(tx.nameState.getName()).to.equal('/foo/bar')
      })
    })
  })

  describe('#setTransactionName', function() {
    it('should not fail when called outside of a transaction', function() {
      expect(function() {
        shim.setTransactionName('foobar')
      }).to.not.throw()
    })

    it('should set the transaction partial name', function() {
      helper.runInTransaction(agent, function(tx) {
        shim.setTransactionName('fizz bang')
        expect(tx.getName()).to.equal('fizz bang')
      })
    })
  })

  describe('#handleCATHeaders', function() {
    it('should not run if disabled', function() {
      helper.runInTransaction(agent, function(tx) {
        var headers = createCATHeaders()
        var segment = shim.getSegment()
        agent.config.cross_application_tracer.enabled = false

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist

        shim.handleCATHeaders(headers, segment)

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist
      })
    })

    it('should not run if the encoding key is missing', function() {
      helper.runInTransaction(agent, function(tx) {
        var headers = createCATHeaders()
        var segment = shim.getSegment()
        delete agent.config.encoding_key

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist

        shim.handleCATHeaders(headers, segment)

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist
      })
    })

    it('should fail gracefully when no headers are given', function() {
      helper.runInTransaction(agent, function(tx) {
        var segment = shim.getSegment()

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist

        expect(function() {
          shim.handleCATHeaders(null, segment)
        }).to.not.throw()

        expect(tx.incomingCatId).to.not.exist
        expect(tx.referringTransactionGuid).to.not.exist
        expect(segment.catId).to.not.exist
        expect(segment.catTransaction).to.not.exist
        expect(segment.getAttributes().transaction_guid).to.not.exist
      })
    })

    describe('when id and transaction data are provided', function() {
      it('should attach the CAT info to the provided segment transaction', function() {
        helper.runInTransaction(agent, shim.WEB, function(tx) {
          var headers = createCATHeaders()
          var segment = shim.getSegment()
          delete headers['X-NewRelic-App-Data']

          expect(tx.incomingCatId).to.not.exist
          expect(tx.referringTransactionGuid).to.not.exist
          expect(tx.tripId).to.not.exist
          expect(tx.referringPathHash).to.not.exist

          helper.runInTransaction(agent, shim.BG, function(tx2) {
            expect(tx2).to.not.equal(tx)
            shim.handleCATHeaders(headers, segment)
          })

          expect(tx.incomingCatId).to.equal('9876#id')
          expect(tx.referringTransactionGuid).to.equal('trans id')
          expect(tx.tripId).to.equal('trip id')
          expect(tx.referringPathHash).to.equal('path hash')
        })
      })

      it('should attach the CAT info to current transaction if not provided', function() {
        helper.runInTransaction(agent, function(tx) {
          var headers = createCATHeaders()
          delete headers['X-NewRelic-App-Data']

          expect(tx.incomingCatId).to.not.exist
          expect(tx.referringTransactionGuid).to.not.exist
          expect(tx.tripId).to.not.exist
          expect(tx.referringPathHash).to.not.exist

          shim.handleCATHeaders(headers)

          expect(tx.incomingCatId).to.equal('9876#id')
          expect(tx.referringTransactionGuid).to.equal('trans id')
          expect(tx.tripId).to.equal('trip id')
          expect(tx.referringPathHash).to.equal('path hash')
        })
      })

      it('should work with alternate header names', function() {
        helper.runInTransaction(agent, shim.WEB, function(tx) {
          var headers = createCATHeaders(true)
          var segment = shim.getSegment()
          delete headers.NewRelicAppData

          expect(tx.incomingCatId).to.not.exist
          expect(tx.referringTransactionGuid).to.not.exist
          expect(tx.tripId).to.not.exist
          expect(tx.referringPathHash).to.not.exist

          helper.runInTransaction(agent, shim.BG, function(tx2) {
            expect(tx2).to.not.equal(tx)
            shim.handleCATHeaders(headers, segment)
          })

          expect(tx.incomingCatId).to.equal('9876#id')
          expect(tx.referringTransactionGuid).to.equal('trans id')
          expect(tx.tripId).to.equal('trip id')
          expect(tx.referringPathHash).to.equal('path hash')
        })
      })

      it('Should propagate w3c tracecontext header when present', function() {
        agent.config.distributed_tracing.enabled = true
        agent.config.feature_flag.dt_format_w3c = true
        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const tracestate = 'test=test'

        helper.runInTransaction(agent, function(tx) {
          const headers = { traceparent, tracestate }
          const segment = shim.getSegment()
          shim.handleCATHeaders(headers, segment)
          expect(tx.traceContext.traceparent).to.equal(traceparent)
          expect(tx.traceContext.tracestate.endsWith(tracestate)).to.be.true
        })
      })
    })

    describe('when app data is provided', function() {
      it('should attach the CAT info to the provided segment', function() {
        helper.runInTransaction(agent, shim.WEB, function(tx) {
          var headers = createCATHeaders()
          var segment = shim.getSegment()
          delete headers['X-NewRelic-Id']
          delete headers['X-NewRelic-Transaction']

          expect(segment.catId).to.not.exist
          expect(segment.catTransaction).to.not.exist
          expect(segment.getAttributes().transaction_guid).to.not.exist

          helper.runInTransaction(agent, shim.BG, function(tx2) {
            expect(tx2).to.not.equal(tx)
            shim.handleCATHeaders(headers, segment)
          })

          expect(segment.catId).to.equal('6789#app')
          expect(segment.catTransaction).to.equal('app data transaction name')
          expect(segment.getAttributes().transaction_guid).to.equal('app trans id')
        })
      })

      it('should attach the CAT info to current segment if not provided', function() {
        helper.runInTransaction(agent, function() {
          var headers = createCATHeaders()
          var segment = shim.getSegment()
          delete headers['X-NewRelic-Id']
          delete headers['X-NewRelic-Transaction']

          expect(segment.catId).to.not.exist
          expect(segment.catTransaction).to.not.exist
          expect(segment.getAttributes().transaction_guid).to.not.exist

          shim.handleCATHeaders(headers)

          expect(segment.catId).to.equal('6789#app')
          expect(segment.catTransaction).to.equal('app data transaction name')
          expect(segment.getAttributes().transaction_guid).to.equal('app trans id')
        })
      })

      it('should work with alternate header names', function() {
        helper.runInTransaction(agent, shim.WEB, function(tx) {
          var headers = createCATHeaders(true)
          var segment = shim.getSegment()
          delete headers.NewRelicID
          delete headers.NewRelicTransaction

          expect(segment.catId).to.not.exist
          expect(segment.catTransaction).to.not.exist
          expect(segment.getAttributes().transaction_guid).to.not.exist

          helper.runInTransaction(agent, shim.BG, function(tx2) {
            expect(tx2).to.not.equal(tx)
            shim.handleCATHeaders(headers, segment)
          })

          expect(segment.catId).to.equal('6789#app')
          expect(segment.catTransaction).to.equal('app data transaction name')
          expect(segment.getAttributes().transaction_guid).to.equal('app trans id')
        })
      })

      describe('when the app data is for an untrusted application', function() {
        it('should not attach any CAT data to the segment', function() {
          helper.runInTransaction(agent, function() {
            var headers = createCATHeaders()
            var segment = shim.getSegment()
            delete headers['X-NewRelic-Id']
            delete headers['X-NewRelic-Transaction']
            agent.config.trusted_account_ids = []

            expect(segment.catId).to.not.exist
            expect(segment.catTransaction).to.not.exist
            expect(segment.getAttributes().transaction_guid).to.not.exist

            shim.handleCATHeaders(headers)

            expect(segment.catId).to.not.exist
            expect(segment.catTransaction).to.not.exist
            expect(segment.getAttributes().transaction_guid).to.not.exist
          })
        })
      })
    })

    function createCATHeaders(altNames) {
      expect(agent.config.encoding_key).to.exist
      expect(agent.config.applications()).to.have.length.above(0)

      var idHeader = hashes.obfuscateNameUsingKey('9876#id', agent.config.encoding_key)
      var txHeader = JSON.stringify(['trans id', false, 'trip id', 'path hash'])
      txHeader = hashes.obfuscateNameUsingKey(txHeader, agent.config.encoding_key)

      var appHeader = hashes.obfuscateNameUsingKey(JSON.stringify([
        '6789#app',
        'app data transaction name',
        1, 2, 3, // queue time, response time, and content length
        'app trans id',
        false
      ]), agent.config.encoding_key)

      return altNames ? {
        NewRelicID: idHeader,
        NewRelicTransaction: txHeader,
        NewRelicAppData: appHeader
      } : {
        'X-NewRelic-Id': idHeader,
        'X-NewRelic-Transaction': txHeader,
        'X-NewRelic-App-Data': appHeader
      }
    }
  })

  describe('#insertCATRequestHeaders', function() {
    it('should not run if disabled', function() {
      helper.runInTransaction(agent, function() {
        agent.config.cross_application_tracer.enabled = false
        var headers = {}

        shim.insertCATRequestHeaders(headers)

        expect(headers).to.not.have.property('X-NewRelic-Id')
        expect(headers).to.not.have.property('X-NewRelic-Transaction')
      })
    })

    it('should not run if the encoding key is missing', function() {
      helper.runInTransaction(agent, function() {
        delete agent.config.encoding_key
        var headers = {}

        shim.insertCATRequestHeaders(headers)

        expect(headers).to.not.have.property('X-NewRelic-Id')
        expect(headers).to.not.have.property('X-NewRelic-Transaction')
      })
    })

    it('should fail gracefully when no headers are given', function() {
      helper.runInTransaction(agent, function() {
        expect(function() {
          shim.insertCATRequestHeaders(null)
        }).to.not.throw()
      })
    })

    it('should use X-Http-Style-Headers when useAlt is false', function() {
      helper.runInTransaction(agent, function() {
        var headers = {}
        shim.insertCATRequestHeaders(headers)

        expect(headers).to.not.have.property('NewRelicID')
        expect(headers).to.not.have.property('NewRelicTransaction')
        expect(headers).to.have.property('X-NewRelic-Id', 'RVpaRwNdQBJQ')
        expect(headers)
          .to.have.property('X-NewRelic-Transaction')
          .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      })
    })

    it('should use MessageQueueStyleHeaders when useAlt is true', function() {
      helper.runInTransaction(agent, function() {
        var headers = {}
        shim.insertCATRequestHeaders(headers, true)

        expect(headers).to.not.have.property('X-NewRelic-Id')
        expect(headers).to.not.have.property('X-NewRelic-Transaction')
        expect(headers).to.have.property('NewRelicID', 'RVpaRwNdQBJQ')
        expect(headers)
          .to.have.property('NewRelicTransaction')
          .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      })
    })

    it('should append the current path hash to the transaction', function() {
      helper.runInTransaction(agent, function(tx) {
        tx.nameState.appendPath('foobar')
        expect(tx.pathHashes).to.have.lengthOf(0)

        var headers = {}
        shim.insertCATRequestHeaders(headers)

        expect(tx.pathHashes).to.have.lengthOf(1)
        expect(tx.pathHashes[0]).to.equal('14cd4d06')
      })
    })

    describe('id header', function() {
      it('should be an obfuscated value', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATRequestHeaders(headers)

          expect(headers)
            .to.have.property('X-NewRelic-Id')
            .and.match(/^[a-zA-Z0-9/-]+={0,2}$/)
        })
      })

      it('should deobfuscate to the app id', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATRequestHeaders(headers)

          var id = hashes.deobfuscateNameUsingKey(
            headers['X-NewRelic-Id'],
            agent.config.encoding_key
          )
          expect(id).to.equal('1234#4321')
        })
      })
    })

    describe('transaction header', function() {
      it('should be an obfuscated value', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATRequestHeaders(headers)

          expect(headers)
            .to.have.property('X-NewRelic-Transaction')
            .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        })
      })

      it('should deobfuscate to transaction information', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATRequestHeaders(headers)

          var txInfo = hashes.deobfuscateNameUsingKey(
            headers['X-NewRelic-Transaction'],
            agent.config.encoding_key
          )

          expect(function() {
            txInfo = JSON.parse(txInfo)
          }).to.not.throw()

          expect(txInfo).to.be.an('array').and.have.lengthOf(4)
        })
      })
    })
  })

  describe('#insertCATReplyHeader', function() {
    it('should not run if disabled', function() {
      helper.runInTransaction(agent, function() {
        agent.config.cross_application_tracer.enabled = false
        var headers = {}

        shim.insertCATReplyHeader(headers)

        expect(headers).to.not.have.property('X-NewRelic-App-Data')
      })
    })

    it('should not run if the encoding key is missing', function() {
      helper.runInTransaction(agent, function() {
        delete agent.config.encoding_key
        var headers = {}

        shim.insertCATReplyHeader(headers)

        expect(headers).to.not.have.property('X-NewRelic-App-Data')
      })
    })

    it('should fail gracefully when no headers are given', function() {
      helper.runInTransaction(agent, function() {
        expect(function() {
          shim.insertCATReplyHeader(null)
        }).to.not.throw()
      })
    })

    it('should use X-Http-Style-Headers when useAlt is false', function() {
      helper.runInTransaction(agent, function() {
        var headers = {}
        shim.insertCATReplyHeader(headers)

        expect(headers).to.not.have.property('NewRelicAppData')
        expect(headers)
          .to.have.property('X-NewRelic-App-Data')
          .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      })
    })

    it('should use MessageQueueStyleHeaders when useAlt is true', function() {
      helper.runInTransaction(agent, function() {
        var headers = {}
        shim.insertCATReplyHeader(headers, true)

        expect(headers).to.not.have.property('X-NewRelic-App-Data')
        expect(headers)
          .to.have.property('NewRelicAppData')
          .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
      })
    })

    describe('app data header', function() {
      it('should be an obfuscated value', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATReplyHeader(headers)

          expect(headers)
            .to.have.property('X-NewRelic-App-Data')
            .and.match(/^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        })
      })

      it('should deobfuscate to CAT application data', function() {
        helper.runInTransaction(agent, function() {
          var headers = {}
          shim.insertCATReplyHeader(headers)

          var appData = hashes.deobfuscateNameUsingKey(
            headers['X-NewRelic-App-Data'],
            agent.config.encoding_key
          )

          expect(function() {
            appData = JSON.parse(appData)
          }).to.not.throw()

          expect(appData).to.be.an('array').and.have.lengthOf(7)
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
