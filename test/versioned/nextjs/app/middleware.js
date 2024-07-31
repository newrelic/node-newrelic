'use strict'
const { NextResponse } = require('next/server')

module.exports.middleware = async function middleware(request) {
  if (request.nextUrl.pathname === '/') {
    // This logic is only applied to /about
      const response = NextResponse.next()
      await new Promise((resolve) => {
        setTimeout(resolve, 25)
      })
      response.headers.set('x-bob', 'another-header')
      return response
  }

  if (request.nextUrl.pathname === '/api') {
      const response = NextResponse.next()
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return response
  }

  if (request.nextUrl.pathname.startsWith('/api/person')) {
      const response = NextResponse.next()
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return response
  }

  if (request.nextUrl.pathname.startsWith('/person')) {
      const response = NextResponse.next()
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return response
  }

  if (request.nextUrl.pathname.startsWith('/ssr')) {
      const response = NextResponse.next()
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return response
  }
}
