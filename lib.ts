import { join } from 'std/path/mod.ts'

export async function getTotalDownloads() {
  const downloads = new Map<string, number>()

  for await (const file of Deno.readDir('data')) {
    if (!file.name.endsWith('.json')) continue

    const path = join('data', file.name)
    const data = await Deno.readTextFile(path)
    const records = data.split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))

    for (const record of records) {
      downloads.set(
        record.SKU,
        (downloads.get(record.SKU) ?? 0) + parseInt(record.Units),
      )
    }
  }

  return downloads
}
