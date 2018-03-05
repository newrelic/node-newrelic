'use strict'

var helper = require('../lib/agent_helper')
var chai = require('chai')
var expect  = chai.expect


describe('Error events', function() {
  describe('when error events are disabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it("should not send events to server", function(done) {
      agent.collector.errorEvents = function() {
        throw new Error('Should not have sent error events.')
      }
      agent.config.error_collector.capture_events = false
      agent.errors.add(null, new Error('some error'))
      agent._sendErrorEvents(function() {
        done()
      })
    })

    it('collector can override', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(true)
    })
  })

  describe('when error events are enabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
      agent.config.error_collector.capture_events = true
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    describe('and they are sent', function() {
      var errorsSent = false
      var payload = null

      beforeEach(function(done) {
        agent.config.attributes.enabled = true

        agent.collector.isConnected = function() { return true }
        agent.collector.metricData = function(_payload, cb) { cb() }
        agent.collector.errorEvents = function(_payload, cb) {
          errorsSent = true
          payload = _payload
          cb()
        }

        agent.on('transactionFinished', function() {
          done()
        })

        helper.runInTransaction(agent, function(tx) {
          tx.addAgentAttribute('foo', 'bar')
          tx.addAgentAttribute('request.uri', '/my/awesome/url')
          agent.errors.add(tx, new Error('some error'))
          tx.statusCode = 500
          setTimeout(function() {
            tx.end()
          }, 10)
        })

        agent._processErrorEvents()
      })

      afterEach(function() {
        errorsSent = false
        payload = null
      })

      it('should send events to server', function(done) {
        agent._sendMetrics(function() {
          agent._sendErrorEvents(function() {
            expect(errorsSent).to.be.true
            done()
          })
        })
      })

      it('should send agent attributes', function(done) {
        agent._sendMetrics(function() {
          agent._sendErrorEvents(function() {
            expect(payload).to.be.an('array')
            expect(payload[2]).to.be.an('array')
            expect(payload[2][0]).to.be.an('array')
            expect(payload[2][0][2]).to.be.an('object')

            var attrs = payload[2][0][2]
            expect(attrs).to.have.property('foo', 'bar')
            expect(attrs).to.have.property('request.uri')
            done()
          })
        })
      })
    })

    it('collector can override', function() {
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector can disable using the emergency shut off', function() {
      expect(function() {
        agent.config.onConnect({ collect_error_events: false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector cannot enable using the emergency shut off', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ collect_error_events: true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })
  })

  describe('top-level setting collect_error_events setting', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('overrides error_collector.capture_events when "false"', function(done) {
      agent.collector.errorEvents = function() {
        throw new Error() // FAIL
      }
      agent.config.error_collector.capture_events = true
      agent.config.collect_error_events = false
      agent._sendErrorEvents(function() {
        done()
      })
    })

    it('does not override error_collector.capture_events when "true"', function(done) {
      agent.collector.errorEvents = function() {
        throw new Error() // FAIL
      }
      agent.config.error_collector.capture_events = false
      agent.config.collect_error_events = true
      agent._sendErrorEvents(function() {
        done()
      })
    })
  })
})
