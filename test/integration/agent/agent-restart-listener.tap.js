'use strict'

const tap = require('tap')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')


tap.test('Collector API should connect to staging-collector.newrelic.com', (t) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: true,
      detect_pcf: true,
      detect_gcp: true,
      detect_docker: true
    },
    logging: {
      level: 'trace'
    }
  })
  const agent = new Agent(config)

  agent.start((error, returned) => {
    t.notOk(error, 'connected without error')
    t.ok(returned, 'got boot configuration')
    t.ok(returned.agent_run_id, 'got run ID')

    const initialStoppedListeners = agent.listenerCount('stopped')
    const initialErroredListeners = agent.listenerCount('errored')
    const initialDisconnectedListeners = agent.listenerCount('disconnected')

    agent.collector.restart(() => {
      const currentStoppedListeners = agent.listenerCount('stopped')
      const currentErroredListeners = agent.listenerCount('errored')
      const currentDisconnectedListeners = agent.listenerCount('disconnected')
      t.equal(
        currentStoppedListeners, 
        initialStoppedListeners, 
        'should not have extra stopped listeners'
      )
      t.equal(
        currentErroredListeners, 
        initialErroredListeners, 
        'should not have extra errored listeners'
      )
      t.equal(
        currentDisconnectedListeners, 
        initialDisconnectedListeners, 
        'should not have extra disconnected listeners'
      )

      agent.stop(() => {
        t.end()
      })
    })
  })
})
