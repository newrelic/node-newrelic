'use strict'

const expect = require('chai').expect
const helper = require('../../lib/agent_helper')

const testCases = require('../../lib/cross_agent_tests/distributed_tracing/distributed_tracing.json')

describe('distributed tracing', function() {
  var agent

  beforeEach(() => {
    agent = helper.loadMockedAgent({distributed_tracing: true})
  })

  afterEach(() => {
    helper.unloadAgent(agent)
  })

  testCases.forEach((testCase) => {
    // TODO: implement message queue cat test
    (testCase.transport_type === 'HTTP' ? it : xit)(testCase.test_name, (done) => {
      agent.config.trusted_account_key = testCase.trusted_account_key
      agent.config.span_events.enabled = testCase.span_events_enabled
      helper.runInTransaction(agent, (tx) => {
        testCase['inbound_payload(s)'].forEach((payload) => {
          tx.acceptDistributedTracePayload(payload)
          if (testCase.raises_exception) {
            tx.addException(new Error('uh oh'))
          }
          tx.end(() => {
            const intrinsics = testCase.intrinsics
            intrinsics.target_events.forEach((type) => {
              if (type === 'Span') {
                // TODO: Delete this block when implementing spans v2
                return
              }
              const common = intrinsics.all
              const specific = intrinsics[type] || {}
              var toCheck
              switch(type) {
                case 'Transaction':
                  toCheck = agent.events.toArray()
                  break
                case 'TransactionError':
                  toCheck = agent.errors.getEvents()
                  break
                case 'Span':
                  toCheck = agent.spans.getEvents()
                  break
                default:
                  console.log(`unknown event type ${type}`)
                  return
              }
              const exact = Object.assign(
                specific.exact || {},
                common.exact || {}
              )

              const arbitrary = (specific.expected || []).concat(common.expected || [])

              const unexpected = (specific.unexpected || []).concat(common.unexpected || [])
              console.log(`${type}: ${toCheck.length}`)
              toCheck.forEach((event) => {
                const attributes = event[0]
                arbitrary.forEach((key) => {
                  expect(attributes, `${type} should have ${key}`).to.have.property(key)
                })
                unexpected.forEach((key) => {
                  expect(attributes, `${type} should have no ${key}`).to.not.have.property(key)
                })
                Object.keys(exact).forEach((key) => {
                  expect(attributes[key], `${type} should have equal ${key}`).to.equal(exact[key])
                })
              })
            })
            done()
          })
        })
      })
    })
  })
})

function checkMetrics(agent, metrics) {
}
