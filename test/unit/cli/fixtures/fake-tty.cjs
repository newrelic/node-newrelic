/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Preloaded via `node --require` to make the CLI believe stdin is an
// interactive terminal, so the "no file and no piped input" guard can be
// exercised without a real TTY.
Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
