/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import runTests from './pg.common.mjs'

runTests('native', async function getClient() {
  const pgExport = await import('pg')
  return pgExport.default.native
})
