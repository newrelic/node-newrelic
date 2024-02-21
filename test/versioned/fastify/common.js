/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = module.exports
const helper = require('../../lib/agent_helper')

const ROUTES = {
  ASYNC_RETURN: '/async-return',
  ASYNC_REPLY_SEND: '/async-reply-send',
  SYNC_REPLY_SEND: '/sync-reply-send',
  PLUGIN: '/plugin-registered'
}

const routesToTest = Object.values(ROUTES)
common.routesToTest = routesToTest

/**
 * Creates a series of routes that are designed to test diff
 * use cases of fastify: route handlers(sync/async), errors, named
 * handlers
 *
 * @param {Object} fastify
 */
common.setupRoutes = (fastify) => {
  /**
   * Route's callback is an async function, and response is returned
   */
  fastify.get(ROUTES.ASYNC_RETURN, async () => {
    return { called: ROUTES.ASYNC_RETURN }
  })

  /**
   * Route's callback is an async function, and response is sent via reply
   */
  fastify.get(ROUTES.ASYNC_REPLY_SEND, async (request, reply) => {
    reply.send({ called: ROUTES.ASYNC_REPLY_SEND })
  })

  /**
   * Route's callback is not an async function, and response is sent via reply
   */
  fastify.get(ROUTES.SYNC_REPLY_SEND, (request, reply) => {
    reply.send({ called: ROUTES.SYNC_REPLY_SEND })
  })

  /**
   * Register a route via plugin to make sure our wrapper catches these
   */
  fastify.register(function (fastifyInstance, options, done) {
    fastifyInstance.get(ROUTES.PLUGIN, async () => {
      return { called: ROUTES.PLUGIN }
    })
    done()
  }, {})

  /**
   * Registeres a named route handler for testing adding hooks for
   * every request lifecycle
   */
  fastify.get('/add-hook', function routeHandler(request, reply) {
    reply.send({ hello: 'world' })
  })

  /**
   * Registers a route that throws an error to test the `onError`
   * hook is firing
   */
  fastify.get('/error', async function errorRoute() {
    throw new Error('test onError hook')
  })

  /**
   * Registers a route with a parameterized route to make sure
   * our transaction naming uses the params based naming and not actual
   * values of params
   */
  fastify.get('/params/:id/:parent/edit', async (request) => {
    return { ...request.params }
  })
}

/**
 * Defines both a global middleware and middleware mounted at a specific
 * path. This tests the `middie`, and/or `fastify-express` plugin middlewawre
 * instrumentation
 */
common.registerMiddlewares = ({ fastify, calls }) => {
  function testMiddleware(req, res, next) {
    calls.middleware++
    next()
  }

  fastify.use(testMiddleware)

  function pathMountedMiddleware(req, res, next) {
    next()
  }

  routesToTest.forEach((route) => {
    fastify.use(route, pathMountedMiddleware)
  })
}

/**
 * Helper to make a request and parse the json body
 *
 * @param {Object} address fastify address contains address/port/family
 * @param {string} uri to make request to
 * @returns {Object} parsed json body
 */
common.makeRequest = async ({ address, port, family }, uri) => {
  const formattedAddress = family === 'IPv6' ? `[${address}]` : address
  const { body } = await helper.makeGetRequestAsync(`http://${formattedAddress}:${port}${uri}`)
  return body
}
