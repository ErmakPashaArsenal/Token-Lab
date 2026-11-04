// /p/:id serves the app itself; app.js reads the id from the path and loads the palette.

export async function onRequestGet({ request, env }) {
  return env.ASSETS.fetch(new URL('/', request.url));
}
