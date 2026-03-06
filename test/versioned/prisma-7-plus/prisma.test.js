/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { initPrismaApp, getPostgresUrl } = require('../prisma/setup.js')
const commonTests = require('../prisma/common-tests.js')

test.before(async () => {
  await initPrismaApp({ cwd: __dirname })
})

test.beforeEach(async (ctx) => {
  process.env.DATABASE_URL = getPostgresUrl()
  const agent = helper.instrumentMockedAgent()
  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
  })
  const prisma = new PrismaClient({ adapter })
  ctx.nr = {
    agent,
    prisma
  }
})

test.afterEach(async (ctx) => {
  const { agent } = ctx.nr
  delete process.env.DATABASE_URL
  helper.unloadAgent(agent)
})

const tests = commonTests({ isV7Plus: true, cwd: __dirname })
for (const [title, opts, fn] of tests) {
  test(title, opts, fn)
}
