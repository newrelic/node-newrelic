'use strict'

var helper = require('../../lib/agent_helper')
var hashes = require('../../../lib/util/hashes')

var config = {
  cross_application_tracer: {enabled: true},
  trusted_account_ids: [1337],
  cross_process_id: '2448#8442',
  encoding_key: 'some key',
}
config.obfuscatedId = hashes.obfuscateNameUsingKey(
  config.cross_process_id,
  config.encoding_key
)

var agent = helper.instrumentMockedAgent(null, config)
// require http after creating the agent
var http = require('http')

var server = http.createServer(function(req, res) {
  res.end()
})

server.listen(0, function() {
  process.send({message: 'started', port: server.address().port})
})

agent.on('transactionFinished', function(tx) {
  process.send({
    message: 'transactionFinished',
    intrinsicAttributes: tx.trace.intrinsics
  })
})
