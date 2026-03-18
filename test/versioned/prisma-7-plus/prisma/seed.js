/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const users = require('../../prisma/prisma/users.js')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})
const prisma = new PrismaClient({ adapter })

async function seed() {
  // Clear out the db first
  await prisma.user.deleteMany({})

  for (const user of users) {
    await prisma.user.upsert(user)
  }

  await prisma.$disconnect()
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)

    await prisma.$disconnect()

    throw e
  })
