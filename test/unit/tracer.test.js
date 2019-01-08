'use strict'

const chai = require('chai')
const expect = chai.expect
const helper = require('../lib/agent_helper')
const Segment = require('../../lib/transaction/trace/segment')

const notRunningStates = ['stopped', 'stopping', 'errored']

describe('Tracer', function() {
  let agent = null
  let tracer = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    tracer = agent.tracer
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('#transactionProxy', () => {
    it('should create transaction', () => {
      const wrapped = tracer.transactionProxy(() => {
        const transaction = tracer.getTransaction()
        expect(transaction).to.exist
      })

      wrapped()
    })

    it('should not try to wrap a null handler', function() {
      expect(tracer.transactionProxy(null)).equal(null)
    })

    notRunningStates.forEach((agentState) => {
      it(`should not create transaction when agent state is ${agentState}`, () => {
        agent.setState(agentState)

        const wrapped = tracer.transactionProxy(() => {
          const transaction = tracer.getTransaction()
          expect(transaction).to.not.exist
        })

        wrapped()
      })
    })
  })

  describe('#transactionNestProxy', () => {
    it('should create transaction', () => {
      const wrapped = tracer.transactionNestProxy('web', () => {
        const transaction = tracer.getTransaction()
        expect(transaction).to.exist
      })

      wrapped()
    })

    notRunningStates.forEach((agentState) => {
      it(`should not create transaction when agent state is ${agentState}`, () => {
        agent.setState(agentState)

        const wrapped = tracer.transactionNestProxy('web', () => {
          const transaction = tracer.getTransaction()
          expect(transaction).to.not.exist
        })

        wrapped()
      })
    })

    describe('when proxying a trace segment', function() {
      it('should not try to wrap a null handler', function() {
        helper.runInTransaction(agent, function() {
          expect(tracer.wrapFunction('123', null, null)).equal(null)
        })
      })
    })

    describe('when proxying a callback', function() {
      it('should not try to wrap a null handler', function() {
        helper.runInTransaction(agent, function() {
          expect(tracer.bindFunction(null)).equal(null)
        })
      })
    })

    describe('when handling immutable errors', function() {
      it('should not break in annotation process', function() {
        helper.runInTransaction(agent, function(trans) {
          function wrapMe() {
            const err = new Error("FIREBOMB")
            Object.freeze(err)
            throw err
          }
          expect(tracer.bindFunction(wrapMe, new Segment(trans, 'name'))).throws()
        })
      })
    })

    describe('when a transaction is created inside a transaction', function() {
      it('should reuse the existing transaction instead of nesting', function() {
        helper.runInTransaction(agent, function(outerTransaction) {
          const outerId = outerTransaction.id
          helper.runInTransaction(agent, function(innerTransaction) {
            const innerId = innerTransaction.id

            expect(innerId).equal(outerId)
          })
        })
      })
    })
  })
})
