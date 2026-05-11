/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { defineConfig } = require('prisma/config')
const { getPostgresUrl } = require('./setup')
const path = require('node:path')

module.exports = defineConfig({
  schema: path.resolve(__dirname, 'prisma/schema.prisma7'),
  migrations: {
    path: path.resolve(__dirname, 'prisma/migrations'),
    seed: `node ${path.resolve(__dirname, 'prisma/seed-7plus.js')}`,
  },
  datasource: {
    url: getPostgresUrl(),
  },
})
