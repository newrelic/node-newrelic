/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { defineConfig } = require('prisma/config')
const { getPostgresUrl } = require('../prisma/setup')

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: '../prisma/prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: getPostgresUrl(),
  },
})
