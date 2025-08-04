/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)

const params = require('../../lib/params')

function getPostgresUrl() {
  const pgUser = params.postgres_user
  const pgPassword = params.postgres_pass ? `:${params.postgres_pass}` : ':postgres'
  const pgHost = params.postgres_host
  const pgPort = params.postgres_prisma_port
  const pgDb = params.postgres_db
  return `postgresql://${pgUser}${pgPassword}@${pgHost}:${pgPort}/${pgDb}`
}
async function initPrismaApp() {
  process.env.DATABASE_URL = getPostgresUrl()
  const { version } = require('@prisma/client/package.json')
  // install CLI globally with proper version so the client package can be generated and setup accordingly
  // If this was locally installed, it would get stomped on.
  await exec(`npm install -g prisma@${version}`)
  await exec('prisma generate')
  await exec('prisma migrate reset --force')
  delete process.env.DATABASE_URL
}

module.exports = {
  initPrismaApp,
  getPostgresUrl
}
