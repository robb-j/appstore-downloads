# AppStore Downloads

A script to get an Apple Developer Account's total app downloads per build
identifier with local caching to reduce repeated requests.

## Usage

### Set up

The scripts are written to be used with [Deno](https://deno.land), so you'll
need that installed. You will also need an `AuthKey.p8` which is generated on
the App Store Connect website.

To get your `AuthKey.p8`, go to the "keys" section of the
[App Store Connect](https://appstoreconnect.apple.com/access/api) website.

1. Make a note of your **Issuer ID**, that is needed too
2. Press the add/plus button to start creating a key
3. Pick a memorable name
4. Give it `Sales and reports` access.
5. Generate and download your p8 file.
6. Put your p8 file in the same folder as the scripts named `AuthKey.p8`
7. Take a note of your `KEY ID` too
8. Make a copy of `.env.example` called `.env` and fill in the variables

You can also edit `START_DATE` to tell the script how far to go back

### Fetching data

The `fetch.ts` script runs through and downloads data from the App Store Connect
`v1/salesReports` endpoint and puts the parsed results into
[ND-JSON](http://ndjson.org/) files in the `data` directory.

```sh
# cd to/this/folder

deno task fetch
```

and you should get something like this:

```
┌─────────────────────┬────────┐
│ (idx)               │ Values │
├─────────────────────┼────────┤
│ io.r0b.MiniYubiOath │     41 │
│ io.r0b.BrowserNow   │     17 │
└─────────────────────┴────────┘
```

The caching works similarly to the data the App Store Connect API returns data.

- For years before the current year, there is a single `yyyy.json` file with all
  records stored in there.
- For the current year, there are weekly files up until the current week in
  `yyyy-mm-dd.json`.
- For the current week, there are daily files in the same named files as the
  weekly files.
- When re-running, the script will concatenate old files together to fit back
  into the format.

### Serving data

The `server.ts` script runs a http server that serves the cached results of a
fetch as a JSON endpoint. There are some flags you can set to configure it a
bit.

- `--port` — The port to use, defaults to `:8000`
- `--fetch` — Turn on the fetch. It will run on startup and every 2 hours after
  that

```
# cd to/this/folder

deno task serve
```

There are two endpoints

- `/` returns the app store download counts
- `/healthz` just returns a http 200 to know everything is working

Using the main endpoint, you should get some json like this:

```json
{
  "io.r0b.BrowserNow": 17,
  "io.r0b.MiniYubiOath": 41
}
```

## Deploying

If you want to deploy the script as a container, there is a
[Dockerfile](/Dockerfile) in the repo to describe how to build and run the
server with fetching turned on. You'll have to build the image yourself and push
it to your container registry of choice.

With a container, there are also some examples Kubernetes manifests in
[config.yml](/config.yml) to get started with that.
