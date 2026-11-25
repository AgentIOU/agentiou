// Any other /api/… path (including /api/trust/ with no address) answers with JSON instead of the website's HTML page.
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }

export async function onRequest(): Promise<Response> {
  return new Response(JSON.stringify({ error: 'not_found', message: 'The AgentIOU API has one endpoint: GET /api/trust/{walletAddress}', docs: 'https://agentiou.pages.dev/trust' }, null, 2) + '\n', { status: 404, headers: HEADERS })
}
