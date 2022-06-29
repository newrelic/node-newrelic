/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Head from 'next/head'

export async function getStaticProps() {
  return {
    props: {
      title: 'This is a standard statically built page.'
    }
  }
}


export default function Standard({ title }) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <h1>{title}</h1>
    </>
  )
}
