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
  const infoOut = await exec('npm info @prisma/client version')
  const clientVersion = infoOut.stdout.trim()
  await exec(`npm install prisma@${clientVersion}`)
  await exec('node ./node_modules/prisma/build/index.js generate')
  await exec('node ./node_modules/prisma/build/index.js migrate reset --force')
  delete process.env.DATABASE_URL
}

module.exports = {
  initPrismaApp,
  getPostgresUrl
}
