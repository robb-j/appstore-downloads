#!/usr/bin/env deno run --allow-net=api.appstoreconnect.apple.com --allow-write=data --allow-read=.

import 'std/dotenv/load.ts'

import * as jose from 'jose/index.ts'
import { CsvStream } from 'std/csv/mod.ts'
import { JsonStringifyStream } from 'std/json/mod.ts'
import { join } from 'std/path/mod.ts'
import { getTotalDownloads } from './lib.ts'

const APPSTORE_ISSUER_ID = Deno.env.get('APPSTORE_ISSUER_ID')!
if (!APPSTORE_ISSUER_ID) throw new Error('APPSTORE_ISSUER_ID not set')

const APPSTORE_KEY_ID = Deno.env.get('APPSTORE_KEY_ID')!
if (!APPSTORE_KEY_ID) throw new Error('APPSTORE_KEY_ID not set')

const START_DATE = Deno.env.get('START_DATE')!
if (!START_DATE) throw new Error('START_DATE not set')

const alg = 'ES256'
const api = new URL('https://api.appstoreconnect.apple.com')

const privateKey = await jose.importPKCS8(
  Deno.readTextFileSync('AuthKey.p8'),
  alg,
)

async function isFile(path: string) {
  try {
    const stat = await Deno.stat(path)
    return stat.isFile
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null
    throw error
  }
}

async function fetchReport(frequency: string, reportDate: string) {
  const key = join('data', reportDate + '.json')

  if (await isFile(key)) {
    console.debug('skip', key)
    return
  }
  
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg, kid: APPSTORE_KEY_ID })
    .setIssuedAt()
    .setIssuer(APPSTORE_ISSUER_ID)
    .setAudience('appstoreconnect-v1')
    .setExpirationTime('5m')
    .sign(privateKey)

  const headers = { authorization: `Bearer ${jwt}` }

  console.debug('fetchReport', frequency, reportDate)

  const url = new URL('v1/salesReports', api)
  url.searchParams.append('filter[frequency]', frequency)
  url.searchParams.append('filter[reportDate]', reportDate)
  url.searchParams.append('filter[reportSubType]', 'SUMMARY')
  url.searchParams.append('filter[reportType]', 'SALES')
  url.searchParams.append('filter[vendorNumber]', '86840618')

  const res = await fetch(url, { headers })

  if (!res.ok) {
    const { errors } = await res.json()
    console.error(res.status, res.statusText, JSON.stringify(errors, null, 2))
    if (res.status === 404) {
      await Deno.writeTextFile(key, '')
      return
    }
    throw new Error(res.statusText)
  }

  res.body!
    .pipeThrough(new DecompressionStream('gzip'))
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new CsvStream({ separator: '\t', skipFirstRow: true }),
    )
    .pipeThrough(
      new JsonStringifyStream(),
    )
    .pipeThrough(new TextEncoderStream())
    .pipeThrough(
      Deno.createSync(key),
    )
}

/** Append target's contents into destination then remove target */
async function mergeInto(target: string, destination: string) {
  console.debug('merge %o into %o', target, destination)

  const targetFile = Deno.openSync(target, { read: true })
  const destFile = Deno.openSync(destination, { append: true })

  // pipeTo closes both files
  await targetFile.readable.pipeTo(destFile.writable)

  Deno.remove(target)
}

function getWeekStart(date: Date) {
  const output = new Date(date)
  output.setDate(
    output.getDate() - date.getDay(),
  )
  output.setHours(0, 0, 0, 0)
  return output
}

function getApiDate(date: Date) {
  const yyyy = date.getFullYear()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function fetchData() {
  await Deno.mkdir('data', { recursive: true })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(START_DATE)

  //
  // Merge previous results
  //
  const currentWeek = getWeekStart(today)
  for await (const file of Deno.readDir('data')) {
    if (!file.name.endsWith('.json')) continue

    const fullMatch = /(\d\d\d\d)-(\d\d)-(\d\d)\.json/.exec(file.name)

    if (!fullMatch) continue
    const [year, month, day] = fullMatch.slice(1).map((s) => parseInt(s))
    const date = new Date(`${year}-${month}-${day}`)

    // Merge old years into a single file
    if (date.getFullYear() < today.getFullYear()) {
      await mergeInto(
        join('data', file.name),
        join('data', `${year}.json`),
      )
    }

    // Merge old dailies into weeklies
    if (date.getDay() !== 0 && date.getTime() < currentWeek.getTime()) {
      const start = getWeekStart(date)

      await mergeInto(
        join('data', file.name),
        join('data', `${getApiDate(start)}.json`),
      )
    }
  }

  //
  // Process leading years
  //
  do {
    await fetchReport('YEARLY', date.getFullYear().toString())
    date.setFullYear(date.getFullYear() + 1)
  } while (date.getFullYear() < today.getFullYear())

  //
  // Process leading weeks in current year
  //
  do {
    await fetchReport('WEEKLY', getApiDate(date))
    date.setDate(date.getDate() + 7)
  } while (date.getTime() < currentWeek.getTime())

  //
  // Process current daily
  //
  do {
    await fetchReport('DAILY', getApiDate(date))

    date.setDate(date.getDate() + 1)
  } while (date.getTime() < today.getTime())
}

//
// Loop data and count up
//
if (import.meta.main) {
  await fetchData()

  const downloads = await getTotalDownloads()
  console.table(Object.fromEntries([...downloads]))
}
