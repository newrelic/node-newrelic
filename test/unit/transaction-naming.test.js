'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var API = require('../../api')

describe("Transaction naming:", function() {
  var agent

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it('Transaction should be named /* without any other naming source', function(done) {
    helper.runInTransaction(agent, function(transaction) {
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/*')
      done()
    })
  })

  it('Transaction should not be normalized when 404', function(done) {
    helper.runInTransaction(agent, function(transaction) {
      transaction.nameState.setName('Expressjs', 'GET', '/', null)
      transaction.setName('http://test.test.com/', 404)
      expect(transaction.name).to.equal('WebTransaction/Expressjs/GET/(not found)')
      done()
    })
  })

  it('Instrumentation should trump default naming', function(done) {
    helper.runInTransaction(agent, function(transaction) {
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Expressjs/GET//setByInstrumentation')
      done()
    })
  })

  it('API naming should trump default naming', function(done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('API naming should trump instrumentation naming', function(done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      simulateInstrumentation(transaction)
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('API naming should trump instrumentation naming (order should not matter)',
    function(done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('API should trump 404', function(done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 404)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('Custom naming rules should trump default naming', function(done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function(transaction) {
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Server sent naming rules should be applied when user specified rules are set', function(done) {
    agent.urlNormalizer.addSimple(/\d+/, '*')
    agent.userNormalizer.addSimple(/123/, 'abc')
    helper.runInTransaction(agent, function(transaction) {
      transaction.setName('http://test.test.com/123/456', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/abc/*')
      done()
    })
  })

  it('Custom naming rules should be cleaned up', function(done) {
    agent.userNormalizer.addSimple(/\//, 'test-transaction')
    helper.runInTransaction(agent, function(transaction) {
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Custom naming rules should trump instrumentation naming', function(done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function(transaction) {
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Custom naming rules should trump API calls', function(done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Custom naming rules should trump 404', function(done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    var api = new API(agent)
    helper.runInTransaction(agent, function(transaction) {
      transaction.setName('http://test.test.com/', 404)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })
})

function simulateInstrumentation(transaction) {
  transaction.nameState.setName(
    'Expressjs',
    'GET',
    '/',
    'setByInstrumentation'
  )
}
