'use strict'

const net = require('net')
const tap = require('tap')
const join = require('path').join
const https = require('https')
const proxySetup = require('@newrelic/proxy')
const read = require('fs').readFileSync
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')

let port = 0
const SSL_CONFIG = {
  key: read(join(__dirname, '../lib/test-key.key')),
  cert: read(join(__dirname, '../lib/self-signed-test-certificate.crt')),
}

tap.test('support ssl to the proxy', (t) => {
  const server = proxySetup(https.createServer(SSL_CONFIG))

  server.listen(0, () => {
    port = server.address().port
    const config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      proxy: `https://ssl.lvh.me:${port}`,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      certificates: [
        read(join(__dirname, '..', 'lib', 'ca-certificate.crt'), 'utf8')
      ]
    })
    const agent = new Agent(config)
    const api = new CollectorAPI(agent)

    api.connect((error, response) => {
      t.notOk(error, 'connected without error')

      const returned = response && response.payload
      t.ok(returned, 'got boot configuration')
      t.ok(returned.agent_run_id, 'got run ID')
      t.ok(agent.config.run_id, 'run ID set in configuration')

      api.shutdown((error) => {
        t.notOk(error, 'should have shut down without issue')
        t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')

        server.close()
        t.end()
      })
    })
  })
})

tap.test('setting proxy_port should use the proxy agent', (t) => {
  const server = proxySetup(https.createServer(SSL_CONFIG))

  server.listen(0, () => {
    port = server.address().port
    const config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy_host: 'ssl.lvh.me',
      proxy_port: port,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      },
      certificates: [
        read(join(__dirname, '..', 'lib', 'ca-certificate.crt'), 'utf8')
      ]
    })
    const agent = new Agent(config)
    const api = new CollectorAPI(agent)

    api.connect((error, response) => {
      t.notOk(error, 'connected without error')

      const returned = response && response.payload
      t.ok(returned, 'got boot configuration')
      t.ok(returned.agent_run_id, 'got run ID')
      t.ok(agent.config.run_id, 'run ID set in configuration')

      api.shutdown((error) => {
        t.notOk(error, 'should have shut down without issue')
        t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')

        server.close()
        t.end()
      })
    })
  })
})

tap.test('proxy authentication should set headers', (t) => {
  t.plan(2)

  const server = net.createServer()

  server.on('connection', (socket) => {
    socket.on('data', (chunk) => {
      const data = chunk.toString().split('\r\n')
      t.equal(data[0], 'CONNECT staging-collector.newrelic.com:443 HTTP/1.1')
      t.equal(data[1], 'Proxy-Authorization: Basic YTpi')
      server.close()
    })
    socket.end()
  })

  server.listen(0, () => {
    port = server.address().port
    const config = configurator.initialize({
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      proxy: `http://a:b@localhost:${port}`,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      }
    })
    const agent = new Agent(config)
    const api = new CollectorAPI(agent)

    api.connect(() => {
      t.end()
    })
  })
})

tap.test('no proxy set should not use proxy agent', (t) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  const agent = new Agent(config)
  const api = new CollectorAPI(agent)


  api.connect((error, response) => {
    t.notOk(error, 'connected without error')

    const returned = response && response.payload
    t.ok(returned, 'got boot configuration')
    t.ok(returned.agent_run_id, 'got run ID')
    t.ok(agent.config.run_id, 'run ID set in configuration')

    api.shutdown((error) => {
      t.notOk(error, 'should have shut down without issue')
      t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')

      t.end()
    })
  })
})
