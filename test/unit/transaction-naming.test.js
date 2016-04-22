var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var helper = require('../lib/agent_helper')
var API = require('../../api')

describe("Transaction naming:", function () {
  var agent
  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })
  afterEach(function () {
    helper.unloadAgent(agent)
  })
  it('Transaction should be named /* without any other naming source', function (done) {
    helper.runInTransaction(agent, function (transaction) {
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/*')
      done()
    })
  })

  it('Instrumentation should trump default naming', function (done) {
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/setByInstrumentation')
      done()
    })
  })

  it('API naming should trump default naming', function (done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('API naming should trump instrumentation naming', function (done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('API naming should trump instrumentation naming (order should not matter)',
    function (done) {
    var api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/Custom/override')
      done()
    })
  })

  it('Custom naming rules should trump default naming', function (done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Custom naming rules should trump instrumentation naming', function (done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })

  it('Custom naming rules should trump API calls', function (done) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    var api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.setName('http://test.test.com/', 200)
      expect(transaction.name).equal('WebTransaction/NormalizedUri/test-transaction')
      done()
    })
  })
})

function simulateInstrumentation(transaction) {
  transaction.partialName = 'setByInstrumentation'
}
