/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const SPAN_PREFIX = 'Nodejs/Nextjs'

module.exports = function initialize(shim, render) {
  shim.setFramework(shim.NEXT)
  shim.record(
    render,
    'renderToHTML',
    function renderToHTMLRecorder(shim, renderToHTML, name, [req, res, page]) {
      return {
        inContext(segment) {
          segment.addSpanAttributes({ 'next.page': page })
        },
        req,
        res,
        promise: true,
        name: `${SPAN_PREFIX}/getServerSideProps/${page}`
      }
    }
  )
}
