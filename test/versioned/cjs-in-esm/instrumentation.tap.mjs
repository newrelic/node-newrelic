/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'tap'
import helper from '../../lib/agent_helper.js'
import generateApp from './helpers.mjs'
import axios from 'axios'

test('Registering CommonJS instrumentation in ES Module project', async (t) => {
  const agent = helper.instrumentMockedAgent()
  const app = await generateApp()
  const server = app.listen(0)

  t.teardown(async () => {
    helper.unloadAgent(agent)
    server && server.close()
  })

  agent.on('transactionFinished', (transaction) => {
    t.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//weird/looking/path',
      'transaction has expected name'
    )
  })

  await axios.get(`http://localhost:${server.address().port}/weird/looking/path`)
})
