/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This file provides utility functions used to set up and teardown tests.

module.exports = {
  afterEach,
  requireApolloServer,
  setupCoreTest,
  unloadModules
}

const fs = require('node:fs')
const path = require('node:path')

const helper = require('../agent_helper')
const setupErrorSchema = require('./error-setup')
const { getTypeDefs, resolvers } = require('./data-definitions')

async function afterEach({ t, testDir }) {
  const { agent, server } = t.nr

  if (server) {
    await server.stop()
  }

  helper.unloadAgent(agent)
  unloadModules(testDir)
}

async function setupCoreTest({ t, testDir, agentConfig = {} } = {}) {
  agentConfig.instrumentation = { timers: { enabled: true } }
  const agent = helper.instrumentMockedAgent(agentConfig)
  const apolloServerPkg = requireApolloServer(testDir)
  const { ApolloServer, gql, startStandaloneServer } = apolloServerPkg
  const schema = getTypeDefs(gql)
  const errorSchema = setupErrorSchema(apolloServerPkg, resolvers)

  const server = new ApolloServer({
    typeDefs: [schema, errorSchema],
    resolvers,
    allowBatchedHttpRequests: true
  })

  const { url: serverUrl } = await startStandaloneServer(server, { listen: { port: 0 } })

  t.nr = {
    agent,
    server,
    serverUrl,
    apolloServerPkg,
    config: agent.config,
  }
}

/**
 * This function is utilized to require the appropriate Apollo server modules
 * for the version of Apollo server that is under test (versioned tests cover
 * multiple versions, and the package has changed names over time).
 *
 * @param {string} testDir The path to the versioned test directory, e.g.
 * the path to the `apollo-server` tests.
 *
 * @returns {object} {{ ApolloServer, gql, startStandaloneServer, graphql}}
 */
function requireApolloServer(testDir) {
  const gql = loadModule('graphql-tag', testDir)
  const { pkg: apolloServer, version } = loadModule('@apollo/server', testDir, true)
  const graphql = loadModule('graphql', testDir)

  const { startStandaloneServer } = loadModule('@apollo/server/standalone', testDir)
  return {
    ApolloServer: apolloServer.ApolloServer,
    apolloVersion: version,
    gql,
    startStandaloneServer,
    graphql
  }
}

/**
 * Require a module relative to the tests being run.
 *
 * @param {string} name The module to load.
 * @param {string} rootDir The path to the versioned test directory, e.g.
 * the path to the `apollo-server` tests.
 * @param {boolean} [getPkgVersion] If true, the version of the package will be obtained
 *
 * @returns {object} { pkg, version } or apollo package
 */
function loadModule(name, rootDir, getPkgVersion) {
  if (getPkgVersion === true) {
    const modulePath = path.join(rootDir, 'node_modules', name, 'package.json')
    const { version } = JSON.parse(fs.readFileSync(modulePath, 'utf8'))
    const pkg = require(require.resolve(name, { paths: [rootDir] }))
    return { pkg, version }
  }
  return require(require.resolve(name, { paths: [rootDir] }))
}

/**
 * Removes all Apollo server related modules from the require cache.
 *
 * @param {string} testDir The parent directory for the tests being run. This
 * is used to scope the algorithm to the correct `node_modules` directory.
 * Simply passing `__dirname` from the test suite should be sufficient.
 */
function unloadModules(testDir) {
  const modules = [
    'express',
    'body-parser',
    '@apollo/gateway',
    '@apollo/server',
    '@apollo/server/express4',
    '@apollo/server/standalone',
    '@apollo/subgraph'
  ]
  for (const mod of modules) {
    try {
      const found = require.resolve(mod, { paths: [testDir] })
      delete require.cache[found]
    } catch {}
  }
}
