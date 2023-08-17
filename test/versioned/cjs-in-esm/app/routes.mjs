/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express'
import controller from './controller.mjs'

// eslint-disable-next-line new-cap
const router = express.Router()

router.get('/looking/path', controller.doTest)

export default router
