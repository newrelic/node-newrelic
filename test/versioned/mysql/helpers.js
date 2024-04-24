/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const params = require('../../lib/params')
const { removeMatchedModules } = require('../../lib/cache-buster')

module.exports = async function setupDb(user, db, table, mysql) {
  const regex = new RegExp(/mysql/)
  await createDb(mysql, user, db)
  await createTable(mysql, user, db, table)
  removeMatchedModules(regex)
}

function runCommand(client, cmd) {
  return new Promise((resolve, reject) => {
    client.query(cmd, function (err) {
      if (err && !/^CREATE USER/.test(cmd)) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

async function createDb(mysql, user, db) {
  const client = mysql.createConnection({
    host: params.mysql_host,
    port: params.mysql_port,
    user: 'root',
    database: 'mysql'
  })

  await runCommand(client, `CREATE USER ${user}`)
  await runCommand(client, `GRANT ALL ON *.* TO ${user}`)
  await runCommand(client, `CREATE DATABASE IF NOT EXISTS ${db}`)
  client.end()
}

async function createTable(mysql, user, db, table) {
  const client = mysql.createConnection({
    host: params.mysql_host,
    port: params.mysql_port,
    user: user,
    database: db
  })

  await runCommand(
    client,
    [
      `CREATE TABLE IF NOT EXISTS ${table} (`,
      '  `id`         INTEGER(10) PRIMARY KEY AUTO_INCREMENT,',
      '  `test_value` VARCHAR(255)',
      ')'
    ].join('\n')
  )

  await runCommand(client, `TRUNCATE TABLE ${table}`)
  await runCommand(client, `INSERT INTO ${table} (test_value) VALUE ("hamburgefontstiv")`)
  client.end()
}
