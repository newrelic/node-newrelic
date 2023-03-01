/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function seed() {
  // Clear out the db first
  await prisma.user.deleteMany({})

  await prisma.user.upsert({
    where: { email: 'alice@prisma.io' },
    update: {},
    create: {
      email: 'alice@prisma.io',
      name: 'Alice'
    }
  })

  await prisma.user.upsert({
    where: { email: 'bob@prisma.io' },
    update: {},
    create: {
      email: 'bob@prisma.io',
      name: 'Bob'
    }
  })

  await prisma.$disconnect()
}

module.exports = seed
