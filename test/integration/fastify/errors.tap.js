'use strict'
const tap = require('tap')
const request = require('request')
const helper  = require('../../lib/agent_helper')
const httpErrors = require('http-errors')

const testErrorHandled = (agent, test, uri, port) => {
  request.get(`http://127.0.0.1:${port}${uri}`, function() {
    test.end()
  })
}

tap.test('Test Errors', (test)=>{
  const agent = helper.instrumentMockedAgent()
  const fastify = require('fastify')()

  fastify.use((req, res, next) => {
    // eslint-disable-next-line new-cap
    next(httpErrors.NotFound())
  })

  fastify.listen(0).then(()=>{
    testErrorHandled(
      agent,
      test,
      '/404-via-reply',
      fastify.server.address().port
    )
  })

  test.tearDown(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })
})
