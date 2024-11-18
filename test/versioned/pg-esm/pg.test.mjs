/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import runTests from './pg.common.mjs'

runTests('pure JavaScript', async function getClient() {
  const { default: pg } = await import('pg')
  return pg
})
