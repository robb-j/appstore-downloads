import { fetchData } from './fetch.ts'
import { getTotalDownloads } from './lib.ts'
import * as flags from 'std/flags/mod.ts'

const FETCH_INTERVAL = 2 * 60 * 60 * 1000

const args = flags.parse(Deno.args, {
  string: ['port'],
  boolean: ['fetch'],
  default: {
    port: '8000',
  },
})

if (args.fetch) {
  await fetch()
  setTimeout(() => fetch(), FETCH_INTERVAL)
}

async function fetch() {
  console.debug('fetching data')
  await fetchData()
}

Deno.serve({ port: parseInt(args.port) }, async (request) => {
  const url = new URL(request.url)

  if (url.pathname === '/healthz') {
    return new Response('ok')
  }

  console.log('%s: %o', request.method, url.pathname)

  if (url.pathname === '/') {
    const downloads = await getTotalDownloads()
    return Response.json(Object.fromEntries([...downloads]))
  }

  return new Response('Not found', { status: 404 })
})
