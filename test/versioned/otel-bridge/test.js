/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const url = new URL('https://example.com/path/to/resource?query=string&test=foo&baz=biz')
url.search.split('&').forEach((param) => {
  const [key, value] = param.split('=')
  console.log(key, value)
})
