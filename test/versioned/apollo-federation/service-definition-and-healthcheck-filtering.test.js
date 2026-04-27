/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')

const { loadLibraries, loadGateway } = require('./federated-gateway-server-setup')

async function setup(agentConfig = {}) {
  const agent = helper.instrumentMockedAgent(agentConfig)

  // Do after instrumentation to ensure express isn't loaded too soon.
  const { ApolloServer } = require('@apollo/server')
  const gql = require('graphql-tag')
  const { startStandaloneServer } = require('@apollo/server/standalone')

  const libraryService = await loadLibraries({ ApolloServer, startStandaloneServer, gql })
  const libraryServer = libraryService.server

  const services = [{ name: libraryService.name, url: libraryService.url }]
  return { ApolloServer, gql, startStandaloneServer, agent, services, libraryServer }
}

test(
  'Capture/Ignore Service Definition and Health Check ' +
    'query transaction from sub-graph servers',
  async (t) => {
    await t.test('Should ignore Service Definition query by default', async (t) => {
      const { agent, ApolloServer, gql, startStandaloneServer, services, libraryServer } =
        await setup()
      const ignore = true

      let tx
      agent.on('transactionFinished', (transaction) => {
        tx = transaction
      })

      const gatewayService = await loadGateway({
        ApolloServer,
        gql,
        startStandaloneServer,
        services,
      })
      t.after(async () => {
        helper.unloadAgent(agent)
        await Promise.all([libraryServer.stop(), gatewayService.server.stop()])
      })
      assert.equal(tx.ignore, ignore, `should set transaction.ignore to ${ignore}`)
    })

    await t.test(
      'Should not ignore Service Definition query ' +
        'when captureServiceDefinitionQueries set to true',
      async (t) => {
        const agentConfig = {
          apollo_server: {
            service_definition_queries: true
          }
        }
        const {
          agent,
          ApolloServer,
          gql,
          startStandaloneServer,
          services,
          libraryServer
        } = await setup(agentConfig)
        const ignore = false

        let tx
        agent.on('transactionFinished', (transaction) => {
          tx = transaction
        })

        const gatewayService = await loadGateway({
          ApolloServer,
          gql,
          startStandaloneServer,
          services,
        })
        t.after(async () => {
          helper.unloadAgent(agent)
          await Promise.all([libraryServer.stop(), gatewayService.server.stop()])
        })
        assert.equal(tx.ignore, ignore, `should set transaction.ignore to ${ignore}`)
      }
    )

    await t.test('Should ignore Health Check query by default', async (t) => {
      const { agent, ApolloServer, gql, startStandaloneServer, services, libraryServer } =
        await setup()
      const ignore = true

      let tx
      agent.on('transactionFinished', (transaction) => {
        if (transaction.name.includes('__ApolloServiceHealthCheck__')) {
          tx = transaction
        }
      })

      const gatewayService = await loadGateway({
        ApolloServer,
        gql,
        startStandaloneServer,
        services,
      })
      t.after(async () => {
        helper.unloadAgent(agent)
        await Promise.all([libraryServer.stop(), gatewayService.server.stop()])
      })

      // trigger the healthcheck
      await gatewayService.gateway.serviceHealthCheck()
      assert.equal(tx.ignore, ignore, `should set transaction.ignore to ${ignore}`)
    })

    await t.test(
      'Should not ignore Health Check query when ' + 'captureHealthCheckQueries set to true',
      async (t) => {
        const agentConfig = {
          apollo_server: {
            health_check_queries: true
          }
        }
        const {
          agent,
          ApolloServer,
          gql,
          startStandaloneServer,
          services,
          libraryServer
        } = await setup(agentConfig)
        const ignore = false

        let tx
        agent.on('transactionFinished', (transaction) => {
          if (transaction.name.includes('__ApolloServiceHealthCheck__')) {
            tx = transaction
          }
        })

        const gatewayService = await loadGateway({
          ApolloServer,
          gql,
          startStandaloneServer,
          services,
        })
        t.after(async () => {
          helper.unloadAgent(agent)
          await Promise.all([libraryServer.stop(), gatewayService.server.stop()])
        })

        // trigger the healthcheck
        await gatewayService.gateway.serviceHealthCheck()
        assert.equal(tx.ignore, ignore, `should set transaction.ignore to ${ignore}`)
      }
    )
  }
)
