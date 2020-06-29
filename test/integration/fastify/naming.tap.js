'use strict'
const tap = require('tap')
const requestClient = require('request')
const helper  = require('../../lib/agent_helper')

/**
 * Single function to register all the routes used by the test
 *
 * @todo Would this be better closer to test, or is it good here
 */
const configureFastifyServer = (fastify) => {
  /**
   * Route's callback is an async function, and response is returned
   */
  fastify.get('/async-return', async() => {
    return { called: '/async-return' }
  })

  /**
   * Route's callback is an async function, and response is sent via reply
   */
  fastify.get('/async-reply-send', async(request, reply) => {
    reply.send( { called: '/async-reply-send' } )
  })

  /**
   * Route's callback is not an async function, and response is sent via reply
   */
  fastify.get('/sync-reply-send', (request, reply) => {
    reply.send( { called: '/sync-reply-send' } )
  })

  /**
   * Register a route via plugin to make sure our wrapper catches these
   */
  fastify.register(
    function(fastifyInstance, options, done) {
      fastifyInstance.get('/plugin-registered', async() => {
        return { called: '/plugin-registered' }
      })
      done()
    },
    {}
  )
}

const testUri = (uri, agent, test, port) => {
  agent.on('transactionFinished', (transaction) => {
    test.equals(
      `WebFrameworkUri/Fastify/GET/${uri}`,
      transaction.getName(),
      `transaction name matched for ${uri}`
    )
  })

  requestClient.get(`http://127.0.0.1:${port}${uri}`, function(error, response, body) {
    const result = body = JSON.parse(body)
    test.equals(result.called ,uri, `${uri} url did not error`)
  })
}

tap.test('Test Transaction Naming', (test)=>{
  test.autoend()
  const routesToTest = [
    '/async-return',
    '/async-reply-send',
    '/sync-reply-send',
    '/plugin-registered'
  ]

  let agent
  let fastify

  test.beforeEach((done) => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    fastify = require('fastify')()
    configureFastifyServer(fastify)
    done()
  })

  test.afterEach((done) => {
    helper.unloadAgent(agent)
    fastify.close()
    done()
  })

  for (const [,uri] of routesToTest.entries()) {
    test.test(`testing naming for ${uri} `, (t) => {
      t.autoend()
      t.plan(2)
      fastify.listen(0).then(()=>{
        testUri(uri, agent, t, fastify.server.address().port)
      })
    })
  }
})
