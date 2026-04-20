/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This is a versioned test to ensure this approach continues to
// work with future versions of Apollo Server's plugin execution.

const test = require('node:test')
const assert = require('node:assert')

const { getTypeDefs, resolvers } = require('../../lib/apollo/data-definitions')
const { executeQuery } = require('../../lib/apollo/test-client')

const { ApolloServer } = require('@apollo/server')
const gql = require('graphql-tag')
const { startStandaloneServer } = require('@apollo/server/standalone')

test.beforeEach(async (ctx) => {
  const server = new ApolloServer({
    typeDefs: getTypeDefs(gql),
    resolvers
  })
  const { url: serverUrl } = startStandaloneServer
    ? await startStandaloneServer(server, { listen: { port: 0 } })
    : await server.listen({ port: 0 })

  ctx.nr = {
    server,
    serverUrl
  }
})

test.afterEach((ctx) => {
  ctx.nr.server.stop()
})

test('should not break existing functionality', (t, end) => {
  const { serverUrl } = t.nr
  const query = `query {
      hello
    }`

  executeQuery(serverUrl, query, (err, result) => {
    assert.ifError(err)

    assert.ok(result)
    assert.deepStrictEqual(result.data, { hello: 'hello world' })

    if (result.errors) {
      result.errors.forEach((error) => {
        assert.ifError(error)
      })
    }

    end()
  })
})
