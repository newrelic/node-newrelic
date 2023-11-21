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

let agent = null
let initialize = null
let shim = null

test('PrismaClient unit tests', (t) => {
  t.autoend()
  let sandbox

  t.beforeEach(function () {
    sandbox = sinon.createSandbox()
    agent = helper.loadMockedAgent()
    initialize = require('../../../lib/instrumentation/@prisma/client')
    shim = new DatastoreShim(agent, 'prisma')
    shim.pkgVersion = '4.0.0'
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    sandbox.restore()
  })

  function getMockModule() {
    const PrismaClient = function () {
      this._engine = { datamodel: {}, datasourceOverrides: {} }
    }

    PrismaClient.prototype._executeRequest = sandbox.stub().resolves()

    return PrismaClient
  }

  t.test('should get connection string from datasource url', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "postgresql://postgres:prisma@localhost:5436/db%20with%20spaces"
      }
    `

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

  t.test('should parse connection string from datasource url env var', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    process.env.TEST_URL = 'postgresql://postgres:prisma@host:5437/'
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = env("TEST_URL") 
      }
    `

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

  t.test('should only try to parse the schema once per connection', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "postgresql://postgres:prisma@localhost:5436/db%20with%20spaces"
      }
    `

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      await client._executeRequest({
        args: { query: 'select test from unit-test;' },
        action: 'executeRaw'
      })

      t.end()
    })
  })

  t.test('should properly name segment and assign db attrs to segments', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "postgresql://postgres:prisma@my-host:5436/db"
      }
    `
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
      t.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/select')
      t.equal(thirdSegment.name, 'Datastore/statement/Prisma/schema.unit-test/select')
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
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;"
      }
    `
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
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "postgresql://postgres:prisma@my-host:5436/db"
      }
    `

    helper.runInTransaction(agent, async (tx) => {
      await client._executeRequest({ action: 'executeRaw' })
      const { children } = tx.trace.root
      const [firstSegment] = children
      t.equal(firstSegment.name, 'Datastore/statement/Prisma/other/other')
      t.end()
    })
  })

  t.test('should not crash if it fails to parse prisma schema', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
      }
    `

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ action: 'executeRaw' })
      t.same(client[symbols.prismaConnection], {})
      t.end()
    })
  })

  t.test('should work on 4.11.0', (t) => {
    const version = '4.11.0'
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    shim.pkgVersion = version
    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
        provider = "postgres"
        url = "postgresql://postgres:prisma@my-host:5436/db"
      }
    `

    helper.runInTransaction(agent, async (tx) => {
      await client._executeRequest({ clientMethod: 'user.create', action: 'create' })
      await client._executeRequest({
        args: [['select test from unit-test;']],
        action: 'executeRaw'
      })
      const { children } = tx.trace.root
      t.equal(children.length, 2, 'should have 3 segments')
      const [firstSegment, secondSegment] = children
      t.equal(firstSegment.name, 'Datastore/statement/Prisma/user/create')
      t.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/select')
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

  t.test('should not instrument prisma/client on versions less than 4.0.0', (t) => {
    const MockPrismaClient = getMockModule()
    const prisma = { PrismaClient: MockPrismaClient }

    shim.pkgVersion = '3.8.0'
    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    t.notOk(shim.isWrapped(client._executeRequest), 'should not instrument @prisma/client')
    t.end()
  })
})
