/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { promisify } = require('node:util')
const path = require('node:path')
const exec = promisify(require('node:child_process').exec)
const semver = require('semver')

const params = require('../../lib/params')

function getPostgresUrl() {
  const pgUser = params.postgres_user
  const pgPassword = params.postgres_pass ? `:${params.postgres_pass}` : ':postgres'
  const pgHost = params.postgres_host
  const pgPort = params.postgres_prisma_port
  const pgDb = params.postgres_db
  return `postgresql://${pgUser}${pgPassword}@${pgHost}:${pgPort}/${pgDb}`
}

async function initPrismaApp({ cwd = __dirname } = {}) {
  process.env.DATABASE_URL = getPostgresUrl()
  const manifestPath = require.resolve('@prisma/client/package.json', {
    paths: [path.join(cwd, 'node_modules')]
  })
  const { version } = require(manifestPath)
  const isV7Plus = semver.gte(version, '7.0.0')
  const execOpts = isV7Plus === true ? { cwd } : null

  // install CLI globally with proper version so the client package can be generated and setup accordingly
  // If this was locally installed, it would get stomped on.
  await exec(`npm install -g prisma@${version}`, execOpts)
  await exec('prisma generate', execOpts)
  await exec('prisma migrate reset --force', execOpts)
  if (isV7Plus === true) {
    await exec('prisma db seed', execOpts)
  }

  delete process.env.DATABASE_URL
}

module.exports = {
  initPrismaApp,
  getPostgresUrl
}
