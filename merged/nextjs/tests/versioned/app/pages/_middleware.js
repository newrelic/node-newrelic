/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { NextResponse } = require('next/server')
export async function middleware() {
  const response = NextResponse.next()
  await new Promise((resolve) => {
    setTimeout(resolve, 25)
  })
  response.headers.set('x-bob', 'another-header')
  return response
}
