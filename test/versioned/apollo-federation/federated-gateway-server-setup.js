/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const federatedData = require('./federated-data-definitions')
const { unloadModules, requireApolloServer } = require('../../lib/apollo/test-tools')
const helper = require('../../lib/agent_helper')

async function setupFederatedGateway({ instrumentSubGraphs, agentConfig, ctx }) {
  // load default instrumentation. express being critical
  const agent = helper.instrumentMockedAgent(agentConfig)
  const nrApi = helper.getAgentApi()

  // Do after instrumentation to ensure express isn't loaded too soon.
  const { ApolloServer, gql, apolloVersion, startStandaloneServer } = requireApolloServer(__dirname)

  const subGraphPlugins = []

  // Sub-graph services are currently auto-instrumented via express.
  // Ignore transaction plugin will prevent creation of standard data and indicate
  // to tests we do not intend to assert on these transactions.
  if (!instrumentSubGraphs) {
    const ignoreTransactionPlugin = createIgnoreTransactionPlugin(nrApi)
    subGraphPlugins.push(ignoreTransactionPlugin)
  }

  // Services are not instrumented
  const libraryService = await loadLibraries({
    ApolloServer,
    gql,
    startStandaloneServer,
    plugins: subGraphPlugins
  })
  const bookService = await loadBooks({
    ApolloServer,
    gql,
    startStandaloneServer,
    plugins: subGraphPlugins
  })
  const magazineService = await loadMagazines({
    ApolloServer,
    gql,
    startStandaloneServer,
    plugins: subGraphPlugins
  })

  const services = [
    { name: libraryService.name, url: libraryService.url },
    { name: bookService.name, url: bookService.url },
    { name: magazineService.name, url: magazineService.url }
  ]

  const gatewayService = await loadGateway({
    ApolloServer,
    gql,
    startStandaloneServer,
    services,
  })
  ctx.nr = {
    agent,
    apolloVersion,
    gatewayService,
    libraryService,
    magazineService,
    bookService,
  }
}

async function teardownGateway({ ctx }) {
  const { agent, gatewayService, libraryService, magazineService, bookService } = ctx.nr
  await Promise.all([
    gatewayService.server.stop(),
    magazineService.server.stop(),
    bookService.server.stop(),
    libraryService.server.stop()
  ])
  helper.unloadAgent(agent)
  unloadModules(__dirname)
}

async function loadGateway({ ApolloServer, startStandaloneServer, services, plugins }) {
  const name = 'Gateway'

  const { ApolloGateway, IntrospectAndCompose } = require('@apollo/gateway')

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: services
    })
  })

  const server = new ApolloServer({
    allowBatchedHttpRequests: true,
    gateway,
    subscriptions: false,
    plugins
  })

  const { url } = await startStandaloneServer(server, { listen: { port: 0 } })

  // eslint-disable-next-line no-console
  console.log(`${name} ready at ${url}`)

  return { name, url, server, gateway }
}

async function loadLibraries({ ApolloServer, gql, startStandaloneServer, plugins }) {
  const config = federatedData.getLibraryConfiguration(gql)
  return await loadServer({ ApolloServer, startStandaloneServer, config, plugins })
}

async function loadBooks({ ApolloServer, gql, startStandaloneServer, plugins }) {
  const config = federatedData.getBookConfiguration(gql)
  return await loadServer({ ApolloServer, startStandaloneServer, config, plugins })
}

async function loadMagazines({ ApolloServer, gql, startStandaloneServer, plugins }) {
  const config = federatedData.getMagazineConfiguration(gql)
  return await loadServer({ ApolloServer, startStandaloneServer, config, plugins })
}

async function loadServer({ ApolloServer, config, plugins, startStandaloneServer }) {
  const { buildSubgraphSchema } = require('@apollo/subgraph')

  const { name, typeDefs, resolvers } = config

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins
  })

  const { url } = await startStandaloneServer(server, { listen: { port: 0 } })

  // eslint-disable-next-line no-console
  console.log(`${name} service ready at ${url}`)

  return { name, url, server }
}

function createIgnoreTransactionPlugin(nrApi) {
  return {
    requestDidStart() {
      const transactionHandle = nrApi.getTransaction()
      transactionHandle.ignore()
    }
  }
}

module.exports = {
  setupFederatedGateway,
  teardownGateway,
  loadLibraries,
  loadGateway
}
