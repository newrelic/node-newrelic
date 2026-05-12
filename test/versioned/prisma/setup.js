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
  const manifestPath = require.resolve('@prisma/client/package.json', {
    paths: [path.join(cwd, 'node_modules')]
  })
  const { version } = require(manifestPath)
  const rootPath = `${cwd}/node_modules/.bin`
  const isV7Plus = semver.gte(version, '7.0.0')
  if (isV7Plus) {
    await v7Init({ cwd, rootPath })
  } else {
    await prev7Iinit({ cwd, rootPath })
  }
}

async function v7Init({ cwd, rootPath }) {
  const v7ConfigFile = `--config ${cwd}/prisma-7-config.js`
  await exec(`${rootPath}/prisma generate ${v7ConfigFile}`)
  await exec(`${rootPath}/prisma migrate reset ${v7ConfigFile} --schema ${cwd}/prisma/schema.prisma7 --force`)
  await exec(`${rootPath}/prisma db seed ${v7ConfigFile}`)
}

async function prev7Iinit({ cwd, rootPath }) {
  process.env.DATABASE_URL = getPostgresUrl()
  await exec(`${rootPath}/prisma generate --schema ${cwd}/prisma/schema.prisma`)
  await exec(`${rootPath}/prisma migrate reset --schema ${cwd}/prisma/schema.prisma --force`)
  // run seed manually to appease running these tests from root of agent and in this folder
  await exec(`node ${cwd}/prisma/seed.js`)
  delete process.env.DATABASE_URL
}

module.exports = {
  initPrismaApp,
  getPostgresUrl
}
