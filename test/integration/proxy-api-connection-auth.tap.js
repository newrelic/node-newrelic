'use strict'

const net = require('net')
const tap = require('tap')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')

let port = 0

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
