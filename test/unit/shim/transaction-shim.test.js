/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const hashes = require('../../../lib/util/hashes')
const helper = require('../../lib/agent_helper')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const notRunningStates = ['stopped', 'stopping', 'errored']

tap.Test.prototype.addAssert('isNonWritable', 1, helper.isNonWritable)

/**
 * Creates CAT headers to be used in handleCATHeaders
 * tests below
 *
 * @param {Object} config agent config
 * @param {Boolean} altNames runs the non x-NewRelic headers
 */
function createCATHeaders(config, altNames) {
  const idHeader = hashes.obfuscateNameUsingKey('9876#id', config.encoding_key)
  let txHeader = JSON.stringify(['trans id', false, 'trip id', 'path hash'])
  txHeader = hashes.obfuscateNameUsingKey(txHeader, config.encoding_key)

  const appHeader = hashes.obfuscateNameUsingKey(
    JSON.stringify([
      '6789#app',
      'app data transaction name',
      1,
      2,
      3, // queue time, response time, and content length
      'app trans id',
      false
    ]),
    config.encoding_key
  )

  return altNames
    ? {
        NewRelicID: idHeader,
        NewRelicTransaction: txHeader,
        NewRelicAppData: appHeader
      }
    : {
        'X-NewRelic-Id': idHeader,
        'X-NewRelic-Transaction': txHeader,
        'X-NewRelic-App-Data': appHeader
      }
}

tap.test('TransactionShim', function (t) {
  t.autoend()
  let agent = null
  let shim = null
  let wrappable = null

  function beforeEach() {
    // implicitly disabling distributed tracing to match original config base settings
    agent = helper.loadMockedAgent()
    shim = new TransactionShim(agent, 'test-module')
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      getActiveSegment: function () {
        return agent.tracer.getSegment()
      }
    }

    const params = {
      encoding_key: 'this is an encoding key',
      cross_process_id: '1234#4321'
    }

    agent.config.account_id = 'AccountId1'
    agent.config.primary_application_id = 'AppId1'
    agent.config.trusted_account_ids = [9876, 6789]
    agent.config._fromServer(params, 'encoding_key')
    agent.config._fromServer(params, 'cross_process_id')
  }

  function afterEach() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  }

  t.test('constructor', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should require an agent parameter', function (t) {
      t.throws(function () {
        return new TransactionShim()
      }, /^Shim must be initialized with .*? agent/)
      t.end()
    })

    t.test('should require a module name parameter', function (t) {
      t.throws(function () {
        return new TransactionShim(agent)
      }, /^Shim must be initialized with .*? module name/)
      t.end()
    })
  })

  t.test('#WEB, #BG, #MESSAGE', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    const keys = ['WEB', 'BG', 'MESSAGE']

    keys.forEach((key) => {
      t.test(`${key} should be a non-writable property`, function (t) {
        t.isNonWritable({ obj: shim, key })
        t.end()
      })

      t.test(`${key} should be transaction types`, function (t) {
        t.equal(shim[key], key.toLowerCase())
        t.end()
      })
    })
  })

  t.test('#bindCreateTransaction', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-functions', function (t) {
      shim.bindCreateTransaction(wrappable, 'name', { type: shim.WEB })
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.bindCreateTransaction(wrappable.bar, { type: shim.WEB })
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.bindCreateTransaction(wrappable.bar, null, { type: shim.WEB })
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.bindCreateTransaction(wrappable, 'bar', { type: shim.WEB })
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable, 'bar'))
      t.equal(shim.unwrap(wrappable, 'bar'), original)
      t.end()
    })
  })

  t.test('#bindCreateTransaction wrapper', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should execute the wrapped function', function (t) {
      let executed = false
      const context = {}
      const value = {}
      const wrapped = shim.bindCreateTransaction(
        function (a, b, c) {
          executed = true
          t.equal(this, context)
          t.equal(a, 'a')
          t.equal(b, 'b')
          t.equal(c, 'c')
          return value
        },
        { type: shim.WEB }
      )

      t.notOk(executed)
      const ret = wrapped.call(context, 'a', 'b', 'c')
      t.ok(executed)
      t.equal(ret, value)
      t.end()
    })

    t.test('should create a transaction with the correct type', function (t) {
      shim.bindCreateTransaction(wrappable, 'getActiveSegment', { type: shim.WEB })
      const segment = wrappable.getActiveSegment()
      t.equal(segment.transaction.type, shim.WEB)

      shim.unwrap(wrappable, 'getActiveSegment')
      shim.bindCreateTransaction(wrappable, 'getActiveSegment', { type: shim.BG })
      const bgSegment = wrappable.getActiveSegment()
      t.equal(bgSegment.transaction.type, shim.BG)
      t.end()
    })

    t.test('should not create a nested transaction when `spec.nest` is false', function (t) {
      let webTx = null
      let bgTx = null
      let webCalled = false
      let bgCalled = false
      const bg = shim.bindCreateTransaction(
        function () {
          bgCalled = true
          bgTx = shim.getSegment().transaction
        },
        { type: shim.BG }
      )
      const web = shim.bindCreateTransaction(
        function () {
          webCalled = true
          webTx = shim.getSegment().transaction
          bg()
        },
        { type: shim.WEB }
      )

      web()
      t.ok(webCalled)
      t.ok(bgCalled)
      t.equal(webTx, bgTx)
      t.end()
    })

    notRunningStates.forEach((agentState) => {
      t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        agent.setState(agentState)

        let callbackCalled = false
        let transaction = null
        const wrapped = shim.bindCreateTransaction(
          () => {
            callbackCalled = true
            transaction = shim.tracer.getTransaction()
          },
          { type: shim.BG }
        )

        wrapped()

        t.ok(callbackCalled)
        t.equal(transaction, null)
        t.end()
      })
    })
  })

  t.test('#bindCreateTransaction when `spec.nest` is `true`', function (t) {
    t.autoend()

    let transactions = null
    let web = null
    let bg = null

    t.beforeEach(function () {
      beforeEach()
      transactions = []
      web = shim.bindCreateTransaction(
        function (cb) {
          transactions.push(shim.getSegment().transaction)
          if (cb) {
            cb()
          }
        },
        { type: shim.WEB, nest: true }
      )

      bg = shim.bindCreateTransaction(
        function (cb) {
          transactions.push(shim.getSegment().transaction)
          if (cb) {
            cb()
          }
        },
        { type: shim.BG, nest: true }
      )
    })
    t.afterEach(afterEach)

    t.test('should create a nested transaction if the types differ', function (t) {
      web(bg)
      t.equal(transactions.length, 2)
      t.not(transactions[0], transactions[1])

      transactions = []
      bg(web)
      t.equal(transactions.length, 2)
      t.not(transactions[0], transactions[1])
      t.end()
    })

    t.test('should not create nested transactions if the types are the same', function (t) {
      web(web)
      t.equal(transactions.length, 2)
      t.equal(transactions[0], transactions[1])

      transactions = []
      bg(bg)
      t.equal(transactions.length, 2)
      t.equal(transactions[0], transactions[1])
      t.end()
    })

    t.test('should create transactions if the types alternate', function (t) {
      web(bg.bind(null, web.bind(null, bg)))
      t.equal(transactions.length, 4)
      for (let i = 0; i < transactions.length; ++i) {
        const tx1 = transactions[i]
        for (let j = i + 1; j < transactions.length; ++j) {
          const tx2 = transactions[j]
          t.not(tx1, tx2, `tx ${i} should not equal tx ${j}`)
        }
      }
      t.end()
    })

    notRunningStates.forEach((agentState) => {
      t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        agent.setState(agentState)

        let callbackCalled = false
        let transaction = null
        const wrapped = shim.bindCreateTransaction(
          () => {
            callbackCalled = true
            transaction = shim.tracer.getTransaction()
          },
          { type: shim.BG, nest: true }
        )

        wrapped()

        t.ok(callbackCalled)
        t.equal(transaction, null)
        t.end()
      })
    })
  })

  t.test('#pushTransactionName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should not fail when called outside of a transaction', function (t) {
      t.doesNotThrow(function () {
        shim.pushTransactionName('foobar')
      })
      t.end()
    })

    t.test('should append the given string to the name state stack', function (t) {
      helper.runInTransaction(agent, function (tx) {
        shim.pushTransactionName('foobar')
        t.equal(tx.nameState.getName(), '/foobar')
        t.end()
      })
    })
  })

  t.test('#popTransactionName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should not fail when called outside of a transaction', function (t) {
      t.doesNotThrow(function () {
        shim.popTransactionName('foobar')
      })
      t.end()
    })

    t.test('should pop to the given string in the name state stack', function (t) {
      helper.runInTransaction(agent, function (tx) {
        shim.pushTransactionName('foo')
        shim.pushTransactionName('bar')
        shim.pushTransactionName('bazz')
        t.equal(tx.nameState.getName(), '/foo/bar/bazz')

        shim.popTransactionName('bar')
        t.equal(tx.nameState.getName(), '/foo')
        t.end()
      })
    })

    t.test('should pop just the last item if no string is given', function (t) {
      helper.runInTransaction(agent, function (tx) {
        shim.pushTransactionName('foo')
        shim.pushTransactionName('bar')
        shim.pushTransactionName('bazz')
        t.equal(tx.nameState.getName(), '/foo/bar/bazz')

        shim.popTransactionName()
        t.equal(tx.nameState.getName(), '/foo/bar')
        t.end()
      })
    })
  })

  t.test('#setTransactionName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should not fail when called outside of a transaction', function (t) {
      t.doesNotThrow(function () {
        shim.setTransactionName('foobar')
      })
      t.end()
    })

    t.test('should set the transaction partial name', function (t) {
      helper.runInTransaction(agent, function (tx) {
        shim.setTransactionName('fizz bang')
        t.equal(tx.getName(), 'fizz bang')
        t.end()
      })
    })
  })

  t.test('#handleCATHeaders', function (t) {
    t.autoend()

    t.beforeEach(() => {
      beforeEach()
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
    })
    t.afterEach(afterEach)

    t.test('should not run if disabled', function (t) {
      helper.runInTransaction(agent, function (tx) {
        agent.config.cross_application_tracer.enabled = false

        const headers = createCATHeaders(agent.config)
        const segment = shim.getSegment()

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)

        shim.handleCATHeaders(headers, segment)

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)
        t.end()
      })
    })

    t.test('should not run if the encoding key is missing', function (t) {
      helper.runInTransaction(agent, function (tx) {
        const headers = createCATHeaders(agent.config)
        const segment = shim.getSegment()
        delete agent.config.encoding_key

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)

        shim.handleCATHeaders(headers, segment)

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)
        t.end()
      })
    })

    t.test('should fail gracefully when no headers are given', function (t) {
      helper.runInTransaction(agent, function (tx) {
        const segment = shim.getSegment()

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)

        t.doesNotThrow(function () {
          shim.handleCATHeaders(null, segment)
        })

        t.notOk(tx.incomingCatId)
        t.notOk(tx.referringTransactionGuid)
        t.notOk(segment.catId)
        t.notOk(segment.catTransaction)
        t.notOk(segment.getAttributes().transaction_guid)
        t.end()
      })
    })

    t.test(
      'should attach the CAT info to the provided segment transaction - DT disabled, id and transaction are provided',
      function (t) {
        helper.runInTransaction(agent, shim.WEB, function (tx) {
          const headers = createCATHeaders(agent.config)
          const segment = shim.getSegment()
          delete headers['X-NewRelic-App-Data']

          t.notOk(tx.incomingCatId)
          t.notOk(tx.referringTransactionGuid)
          t.notOk(tx.tripId)
          t.notOk(tx.referringPathHash)

          helper.runInTransaction(agent, shim.BG, function (tx2) {
            t.not(tx2, tx)
            shim.handleCATHeaders(headers, segment)
          })

          t.equal(tx.incomingCatId, '9876#id')
          t.equal(tx.referringTransactionGuid, 'trans id')
          t.equal(tx.tripId, 'trip id')
          t.equal(tx.referringPathHash, 'path hash')
          t.end()
        })
      }
    )

    t.test(
      'should attach the CAT info to current transaction if not provided - DT disabled, id and transaction are provided',
      function (t) {
        helper.runInTransaction(agent, function (tx) {
          const headers = createCATHeaders(agent.config)
          delete headers['X-NewRelic-App-Data']

          t.notOk(tx.incomingCatId)
          t.notOk(tx.referringTransactionGuid)
          t.notOk(tx.tripId)
          t.notOk(tx.referringPathHash)

          shim.handleCATHeaders(headers)

          t.equal(tx.incomingCatId, '9876#id')
          t.equal(tx.referringTransactionGuid, 'trans id')
          t.equal(tx.tripId, 'trip id')
          t.equal(tx.referringPathHash, 'path hash')
          t.end()
        })
      }
    )

    t.test(
      'should work with alternate header names - DT disabled, id and transaction are provided',
      function (t) {
        helper.runInTransaction(agent, shim.WEB, function (tx) {
          const headers = createCATHeaders(agent.config, true)
          const segment = shim.getSegment()
          delete headers.NewRelicAppData

          t.notOk(tx.incomingCatId)
          t.notOk(tx.referringTransactionGuid)
          t.notOk(tx.tripId)
          t.notOk(tx.referringPathHash)

          helper.runInTransaction(agent, shim.BG, function (tx2) {
            t.not(tx2, tx)
            shim.handleCATHeaders(headers, segment)
          })

          t.equal(tx.incomingCatId, '9876#id')
          t.equal(tx.referringTransactionGuid, 'trans id')
          t.equal(tx.tripId, 'trip id')
          t.equal(tx.referringPathHash, 'path hash')
          t.end()
        })
      }
    )

    t.test(
      'Should propagate w3c tracecontext header when present, id and transaction are provided',
      function (t) {
        agent.config.distributed_tracing.enabled = true

        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const tracestate = 'test=test'

        helper.runInTransaction(agent, function (tx) {
          const headers = { traceparent, tracestate }
          const segment = shim.getSegment()
          shim.handleCATHeaders(headers, segment)

          const outboundHeaders = {}
          tx.insertDistributedTraceHeaders(outboundHeaders)

          t.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b3'))
          t.ok(outboundHeaders.tracestate.endsWith(tracestate))
          t.end()
        })
      }
    )

    t.test(
      'Should propagate w3c tracecontext header when no tracestate, id and transaction are provided',
      function (t) {
        agent.config.distributed_tracing.enabled = true

        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

        helper.runInTransaction(agent, function (tx) {
          const headers = { traceparent }
          const segment = shim.getSegment()
          shim.handleCATHeaders(headers, segment)

          const outboundHeaders = {}
          tx.insertDistributedTraceHeaders(outboundHeaders)

          t.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b3'))
          t.end()
        })
      }
    )

    t.test(
      'Should propagate w3c tracecontext header when tracestate empty string, id and transaction are provided',
      function (t) {
        agent.config.distributed_tracing.enabled = true

        const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const tracestate = ''

        helper.runInTransaction(agent, function (tx) {
          const headers = { traceparent, tracestate }
          const segment = shim.getSegment()
          shim.handleCATHeaders(headers, segment)

          const outboundHeaders = {}
          tx.insertDistributedTraceHeaders(outboundHeaders)

          t.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b3'))
          t.end()
        })
      }
    )

    t.test('should propagate w3c headers when CAT expicitly disabled', (t) => {
      agent.config.cross_application_tracer.enabled = false
      agent.config.distributed_tracing.enabled = true

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function (tx) {
        const headers = { traceparent, tracestate }
        const segment = shim.getSegment()
        shim.handleCATHeaders(headers, segment)

        const outboundHeaders = {}
        tx.insertDistributedTraceHeaders(outboundHeaders)

        t.ok(outboundHeaders.traceparent.startsWith('00-4bf92f3577b3'))
        t.ok(outboundHeaders.tracestate.endsWith(tracestate))
        t.end()
      })
    })

    t.test(
      'should attach the CAT info to the provided segment - DT disabled, app data is provided',
      function (t) {
        helper.runInTransaction(agent, shim.WEB, function (tx) {
          const headers = createCATHeaders(agent.config)
          const segment = shim.getSegment()
          delete headers['X-NewRelic-Id']
          delete headers['X-NewRelic-Transaction']

          t.notOk(segment.catId)
          t.notOk(segment.catTransaction)
          t.notOk(segment.getAttributes().transaction_guid)

          helper.runInTransaction(agent, shim.BG, function (tx2) {
            t.not(tx2, tx)
            shim.handleCATHeaders(headers, segment)
          })

          t.equal(segment.catId, '6789#app')
          t.equal(segment.catTransaction, 'app data transaction name')
          t.equal(segment.getAttributes().transaction_guid, 'app trans id')
          t.end()
        })
      }
    )

    t.test(
      'should attach the CAT info to current segment if not provided - DT disabled, app data is provided',
      function (t) {
        helper.runInTransaction(agent, function () {
          const headers = createCATHeaders(agent.config)
          const segment = shim.getSegment()
          delete headers['X-NewRelic-Id']
          delete headers['X-NewRelic-Transaction']

          t.notOk(segment.catId)
          t.notOk(segment.catTransaction)
          t.notOk(segment.getAttributes().transaction_guid)

          shim.handleCATHeaders(headers)

          t.equal(segment.catId, '6789#app')
          t.equal(segment.catTransaction, 'app data transaction name')
          t.equal(segment.getAttributes().transaction_guid, 'app trans id')
          t.end()
        })
      }
    )

    t.test(
      'should work with alternate header names - DT disabled, app data is provided',
      function (t) {
        helper.runInTransaction(agent, shim.WEB, function (tx) {
          const headers = createCATHeaders(agent.config, true)
          const segment = shim.getSegment()
          delete headers.NewRelicID
          delete headers.NewRelicTransaction

          t.notOk(segment.catId)
          t.notOk(segment.catTransaction)
          t.notOk(segment.getAttributes().transaction_guid)

          helper.runInTransaction(agent, shim.BG, function (tx2) {
            t.not(tx2, tx)
            shim.handleCATHeaders(headers, segment)
          })

          t.equal(segment.catId, '6789#app')
          t.equal(segment.catTransaction, 'app data transaction name')
          t.equal(segment.getAttributes().transaction_guid, 'app trans id')
          t.end()
        })
      }
    )

    t.test(
      'should not attach any CAT data to the segment, app data is for an untrusted application',
      function (t) {
        helper.runInTransaction(agent, function () {
          const headers = createCATHeaders(agent.config)
          const segment = shim.getSegment()
          delete headers['X-NewRelic-Id']
          delete headers['X-NewRelic-Transaction']
          agent.config.trusted_account_ids = []

          t.notOk(segment.catId)
          t.notOk(segment.catTransaction)
          t.notOk(segment.getAttributes().transaction_guid)

          shim.handleCATHeaders(headers)

          t.notOk(segment.catId)
          t.notOk(segment.catTransaction)
          t.notOk(segment.getAttributes().transaction_guid)
          t.end()
        })
      }
    )
  })

  t.test('#insertCATRequestHeaders', function (t) {
    t.autoend()
    t.beforeEach(() => {
      beforeEach()
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
    })
    t.afterEach(afterEach)
    t.test('should not run if disabled', function (t) {
      helper.runInTransaction(agent, function () {
        agent.config.cross_application_tracer.enabled = false
        const headers = {}

        shim.insertCATRequestHeaders(headers)

        t.notOk(headers['X-NewRelic-Id'])
        t.notOk(headers['X-NewRelic-Transaction'])
        t.end()
      })
    })

    t.test('should not run if the encoding key is missing', function (t) {
      helper.runInTransaction(agent, function () {
        delete agent.config.encoding_key
        const headers = {}

        shim.insertCATRequestHeaders(headers)

        t.notOk(headers['X-NewRelic-Id'])
        t.notOk(headers['X-NewRelic-Transaction'])
        t.end()
      })
    })

    t.test('should fail gracefully when no headers are given', function (t) {
      helper.runInTransaction(agent, function () {
        t.doesNotThrow(function () {
          shim.insertCATRequestHeaders(null)
        })
        t.end()
      })
    })

    t.test('should use X-Http-Style-Headers when useAlt is false - DT disabled', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATRequestHeaders(headers)

        t.notOk(headers.NewRelicID)
        t.notOk(headers.NewRelicTransaction)
        t.equal(headers['X-NewRelic-Id'], 'RVpaRwNdQBJQ')
        t.match(headers['X-NewRelic-Transaction'], /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        t.end()
      })
    })

    t.test(
      'should use MessageQueueStyleHeaders when useAlt is true with DT disabled',
      function (t) {
        helper.runInTransaction(agent, function () {
          const headers = {}
          shim.insertCATRequestHeaders(headers, true)

          t.notOk(headers['X-NewRelic-Id'])
          t.notOk(headers['X-NewRelic-Transaction'])
          t.equal(headers.NewRelicID, 'RVpaRwNdQBJQ')
          t.match(headers.NewRelicTransaction, /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
          t.end()
        })
      }
    )

    t.test('should append the current path hash to the transaction - DT disabled', function (t) {
      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('foobar')
        t.equal(tx.pathHashes.length, 0)

        const headers = {}
        shim.insertCATRequestHeaders(headers)

        t.equal(tx.pathHashes.length, 1)
        t.equal(tx.pathHashes[0], '0f9570a6')
        t.end()
      })
    })

    t.test('should be an obfuscated value - DT disabled, id header', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATRequestHeaders(headers)

        t.match(headers['X-NewRelic-Id'], /^[a-zA-Z0-9/-]+={0,2}$/)
        t.end()
      })
    })

    t.test('should deobfuscate to the app id - DT disabled, id header', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATRequestHeaders(headers)

        const id = hashes.deobfuscateNameUsingKey(
          headers['X-NewRelic-Id'],
          agent.config.encoding_key
        )
        t.equal(id, '1234#4321')
        t.end()
      })
    })

    t.test('should be an obfuscated value - DT disabled, transaction header', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATRequestHeaders(headers)

        t.match(headers['X-NewRelic-Transaction'], /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        t.end()
      })
    })

    t.test(
      'should deobfuscate to transaction information - DT disabled, transaction header',
      function (t) {
        helper.runInTransaction(agent, function () {
          const headers = {}
          shim.insertCATRequestHeaders(headers)

          let txInfo = hashes.deobfuscateNameUsingKey(
            headers['X-NewRelic-Transaction'],
            agent.config.encoding_key
          )

          t.doesNotThrow(function () {
            txInfo = JSON.parse(txInfo)
          })

          t.ok(Array.isArray(txInfo))
          t.equal(txInfo.length, 4)
          t.end()
        })
      }
    )
  })

  t.test('#insertCATReplyHeader', function (t) {
    t.autoend()
    t.beforeEach(() => {
      beforeEach()
      agent.config.cross_application_tracer.enabled = true
      agent.config.distributed_tracing.enabled = false
    })
    t.afterEach(afterEach)

    t.test('should not run if disabled', function (t) {
      helper.runInTransaction(agent, function () {
        agent.config.cross_application_tracer.enabled = false
        const headers = {}

        shim.insertCATReplyHeader(headers)

        t.notOk(headers['X-NewRelic-App-Data'])
        t.end()
      })
    })

    t.test('should not run if the encoding key is missing', function (t) {
      helper.runInTransaction(agent, function () {
        delete agent.config.encoding_key
        const headers = {}

        shim.insertCATReplyHeader(headers)

        t.notOk(headers['X-NewRelic-App-Data'])
        t.end()
      })
    })

    t.test('should fail gracefully when no headers are given', function (t) {
      helper.runInTransaction(agent, function () {
        t.doesNotThrow(function () {
          shim.insertCATReplyHeader(null)
        })
        t.end()
      })
    })

    t.test('should use X-Http-Style-Headers when useAlt is false - DT disabled', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATReplyHeader(headers)

        t.notOk(headers.NewRelicAppData)
        t.match(headers['X-NewRelic-App-Data'], /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        t.end()
      })
    })

    t.test('should use MessageQueueStyleHeaders when useAlt is true - DT disabled', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATReplyHeader(headers, true)

        t.notOk(headers['X-NewRelic-App-Data'])
        t.match(headers.NewRelicAppData, /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        t.end()
      })
    })

    t.test('should be an obfuscated value - DT disabled, app data header', function (t) {
      helper.runInTransaction(agent, function () {
        const headers = {}
        shim.insertCATReplyHeader(headers)

        t.match(headers['X-NewRelic-App-Data'], /^[a-zA-Z0-9/-]{60,80}={0,2}$/)
        t.end()
      })
    })

    t.test(
      'should deobfuscate to CAT application data - DT disabled, app data header',
      function (t) {
        helper.runInTransaction(agent, function () {
          const headers = {}
          shim.insertCATReplyHeader(headers)

          let appData = hashes.deobfuscateNameUsingKey(
            headers['X-NewRelic-App-Data'],
            agent.config.encoding_key
          )

          t.doesNotThrow(function () {
            appData = JSON.parse(appData)
          })

          t.equal(appData.length, 7)
          t.ok(Array.isArray(appData))
          t.end()
        })
      }
    )
  })
})
