/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Head from 'next/head'

export async function getProps(params) {
  return {
    title: 'This is a statically built dynamic route page.',
    value: params.value
  }
}

export async function generateStaticPaths() {
  return [
    { value: 'testing' }
  ]
}


export default async function Standard({ params }) {
  const { title, value } = await getProps(params)
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <h1>{title}</h1>
      <div>Value: {value}</div>
    </>
  )
}
