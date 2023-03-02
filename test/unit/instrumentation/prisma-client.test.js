/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
const symbols = require('../../../lib/symbols')
const sinon = require('sinon')
const semver = require('semver')

let agent = null
let initialize = null
let shim = null

test('PrismaClient unit tests', (t) => {
  t.autoend()

  t.beforeEach(function () {
    // TODO: update to use loadMockedAgent with async local context manager when we drop Node 14
    // enabling async local ctx mgr so I don't have to call instrumentMockedAgent which bootstraps
    // all instrumentation. Need context propagation for the inContext function
    // agent = helper.loadMockedAgent({ feature_flag: { async_local_context: true } })
    agent = helper.instrumentMockedAgent()
    initialize = require('../../../lib/instrumentation/@prisma/client')
    shim = new DatastoreShim(agent, 'prisma')
    sinon.stub(shim, 'require')
    shim.require.returns({ version: '4.0.0' })
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
  })

  function getMockModule(version = '4.0.0') {
    function Engine() {}

    Engine.prototype.getConfig = sinon.stub()
    let PrismaClient
    if (semver.gte(version, '4.11.0')) {
      PrismaClient = function PrismaClient() {
        this._engine = {}
        this._engine.library = new Engine()
      }
    } else {
      PrismaClient = function PrismaClient() {
        this._engine = new Engine()
      }
    }

    PrismaClient.prototype._executeRequest = sinon.stub().resolves()

    return PrismaClient
  }

  t.test('should parse connection string from url.value', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.getConfig.resolves({
      datasources: [
        {
          provider: 'postgres',
          url: { value: 'postgresql://postgres:prisma@localhost:5436/db%20with%20spaces' }
        }
      ]
    })

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create' })
      t.same(client[symbols.prismaConnection], {
        host: 'localhost',
        port: '5436',
        dbName: 'db with spaces'
      })
      t.end()
    })
  })

  t.test('should parse connection string from url.fromEnvVar', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    process.env.TEST_URL = 'postgresql://postgres:prisma@host:5437/'
    client._engine.getConfig.resolves({
      datasources: [{ provider: 'postgres', url: { fromEnvVar: 'TEST_URL' } }]
    })

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create' })
      t.same(client[symbols.prismaConnection], {
        host: 'host',
        port: '5437',
        dbName: ''
      })
      t.end()
    })
  })

  t.test('should only call _engine.getConfig once per connection', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.getConfig.resolves({
      datasources: [
        {
          provider: 'postgres',
          url: { value: 'postgresql://postgres:prisma@localhost:5436/db%20with%20spaces' }
        }
      ]
    })

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      await client._executeRequest({
        args: { query: 'select test from unit-test;' },
        action: 'executeRaw'
      })
      t.equal(
        client._engine.getConfig.callCount,
        1,
        'should only call getConfig once per connection'
      )
      t.end()
    })
  })

  t.test('should properly name segment and assign db attrs to segments', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.getConfig.resolves({
      datasources: [
        { provider: 'postgres', url: { value: 'postgresql://postgres:prisma@my-host:5436/db' } }
      ]
    })

    helper.runInTransaction(agent, async (tx) => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      await client._executeRequest({
        args: { query: 'select test from unit-test;' },
        action: 'executeRaw'
      })
      await client._executeRequest({
        args: { query: 'select test from schema.unit-test;' },
        action: 'executeRaw'
      })
      const { children } = tx.trace.root
      t.equal(children.length, 3, 'should have 3 segments')
      const [firstSegment, secondSegment, thirdSegment] = children
      t.equal(firstSegment.name, 'Datastore/statement/Prisma/user/create')
      t.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/executeRaw(select)')
      t.equal(thirdSegment.name, 'Datastore/statement/Prisma/unit-test/executeRaw(select)')
      t.same(firstSegment.getAttributes(), {
        product: 'Prisma',
        host: 'my-host',
        port_path_or_id: '5436',
        database_name: 'db'
      })
      t.same(firstSegment.getAttributes(), secondSegment.getAttributes())
      t.end()
    })
  })

  t.test('should not set connection params if fails to parse connection string', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.getConfig.resolves({
      datasources: [
        {
          provider: 'sqlserver',
          url: {
            value:
              'Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;'
          }
        }
      ]
    })

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      t.same(client[symbols.prismaConnection], {})
      t.end()
    })
  })

  t.test('should not set connection params if it fails to retrieve config', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    const err = new Error('i failed')
    client._engine.getConfig.rejects(err)

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      t.same(client[symbols.prismaConnection], {})
      t.end()
    })
  })

  t.test('should not crash if it fails to extract query from call', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.getConfig.resolves({
      datasources: [
        { provider: 'postgres', url: { value: 'postgresql://postgres:prisma@my-host:5436/db' } }
      ]
    })

    helper.runInTransaction(agent, async (tx) => {
      await client._executeRequest({ action: 'executeRaw' })
      const { children } = tx.trace.root
      const [firstSegment] = children
      t.equal(firstSegment.name, 'Datastore/statement/Prisma/other/executeRaw(other)')
      t.end()
    })
  })

  t.test('should work on 4.11.0', (t) => {
    const version = '4.11.0'
    const MockPrismaClient = getMockModule(version)
    const prisma = { PrismaClient: MockPrismaClient }

    shim.require.returns({ version })
    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.library.getConfig.returns({
      datasources: [
        { provider: 'postgres', url: { value: 'postgresql://postgres:prisma@my-host:5436/db' } }
      ]
    })

    helper.runInTransaction(agent, async (tx) => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      await client._executeRequest({
        args: [['select test from unit-test;']],
        action: 'executeRaw'
      })
      const { children } = tx.trace.root
      t.equal(children.length, 2, 'should have 2 segments')
      const firstSegment = children[0]
      const secondSegment = children[1]
      t.equal(firstSegment.name, 'Datastore/statement/Prisma/user/create')
      t.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/executeRaw(select)')
      t.same(firstSegment.getAttributes(), {
        product: 'Prisma',
        host: 'my-host',
        port_path_or_id: '5436',
        database_name: 'db'
      })
      t.same(firstSegment.getAttributes(), secondSegment.getAttributes())
      t.end()
    })
  })

  t.test('should not set connection params in 4.11.0+ if it fails to retrieve config', (t) => {
    const version = '4.11.0'
    const MockPrismaClient = getMockModule(version)
    const prisma = { PrismaClient: MockPrismaClient }

    shim.require.returns({ version })
    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    const err = new Error('i failed')
    client._engine.library.getConfig.throws(err)

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      t.same(client[symbols.prismaConnection], {})
      t.end()
    })
  })
})
