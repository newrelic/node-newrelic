/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import runTests from './pg.common.mjs'

runTests('forced native', async function getClient() {
  // setting env var for forcing native
  process.env.NODE_PG_FORCE_NATIVE = true
  const pgExport = await import('pg')
  const pg = pgExport.default
  delete process.env.NODE_PG_FORCE_NATIVE
  return pg
})
