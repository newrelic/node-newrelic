/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
const symbols = require('../../../lib/symbols')
const sinon = require('sinon')

test('PrismaClient unit.tests', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    ctx.nr.initialize = require('../../../lib/instrumentation/@prisma/client')
    const shim = new DatastoreShim(agent, 'prisma')
    shim.pkgVersion = '4.0.0'
    ctx.nr.shim = shim
    ctx.nr.agent = agent
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.sandbox.restore()
  })

  await t.test('should get connection string from datasource url', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.deepEqual(client[symbols.prismaConnection], {
        host: 'localhost',
        port: '5436',
        dbName: 'db with spaces'
      })
      end()
    })
  })

  await t.test('should parse connection string from datasource url env var', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.deepEqual(client[symbols.prismaConnection], {
        host: 'host',
        port: '5437',
        dbName: ''
      })
      end()
    })
  })

  await t.test('should only try to parse the schema once per connection', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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

      end()
    })
  })

  await t.test('should properly name segment and assign db attrs to segments', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.equal(children.length, 3, 'should have 3 segments')
      const [firstSegment, secondSegment, thirdSegment] = children
      assert.equal(firstSegment.name, 'Datastore/statement/Prisma/user/create')
      assert.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/select')
      assert.equal(thirdSegment.name, 'Datastore/statement/Prisma/schema.unit-test/select')
      assert.deepEqual(firstSegment.getAttributes(), {
        product: 'Prisma',
        host: 'my-host',
        port_path_or_id: '5436',
        database_name: 'db'
      })
      assert.deepEqual(firstSegment.getAttributes(), secondSegment.getAttributes())
      end()
    })
  })

  await t.test('should not set connection params if fails to parse connection string', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.deepEqual(client[symbols.prismaConnection], {})
      end()
    })
  })

  await t.test('should not crash if it fails to extract query from call', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.equal(firstSegment.name, 'Datastore/statement/Prisma/other/other')
      end()
    })
  })

  await t.test('should not crash if it fails to parse prisma schema', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
    const prisma = { PrismaClient: MockPrismaClient }

    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    client._engine.datamodel = `
      datasource db {
      }
    `

    helper.runInTransaction(agent, async () => {
      await client._executeRequest({ action: 'executeRaw' })
      assert.deepEqual(client[symbols.prismaConnection], {})
      end()
    })
  })

  await t.test('should work on 4.11.0', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const version = '4.11.0'
    const MockPrismaClient = getMockModule({ sandbox })
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
      assert.equal(children.length, 2, 'should have 3 segments')
      const [firstSegment, secondSegment] = children
      assert.equal(firstSegment.name, 'Datastore/statement/Prisma/user/create')
      assert.equal(secondSegment.name, 'Datastore/statement/Prisma/unit-test/select')
      assert.deepEqual(firstSegment.getAttributes(), {
        product: 'Prisma',
        host: 'my-host',
        port_path_or_id: '5436',
        database_name: 'db'
      })
      assert.deepEqual(firstSegment.getAttributes(), secondSegment.getAttributes())
      end()
    })
  })

  await t.test('should not instrument prisma/client on versions less than 4.0.0', (t, end) => {
    const { agent, initialize, sandbox, shim } = t.nr
    const MockPrismaClient = getMockModule({ sandbox })
    const prisma = { PrismaClient: MockPrismaClient }

    shim.pkgVersion = '3.8.0'
    initialize(agent, prisma, '@prisma/client', shim)
    const client = new prisma.PrismaClient()
    assert.ok(!shim.isWrapped(client._executeRequest), 'should not instrument @prisma/client')
    end()
  })
})

function getMockModule({ sandbox }) {
  const PrismaClient = function () {
    this._engine = { datamodel: {}, datasourceOverrides: {} }
  }

  PrismaClient.prototype._executeRequest = sandbox.stub().resolves()

  return PrismaClient
}
