/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Head from 'next/head'

export async function getStaticProps({ params }) {
  return {
    props: {
      title: 'This is a statically built dynamic route page.',
      value: params.value
    }
  }
}

export async function getStaticPaths() {
  return {
    paths: [
      { params: { value: 'testing' } }
    ],
    fallback: false
  }
}


export default function Standard({ title, value }) {
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
