import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// "preview" mode builds the copy that runs inside a claude.ai artifact: relative paths and #name routes.
// The public build carries its own Content-Security-Policy, so the rules hold even if the host's headers are missing:
// only this site's own scripts run, nothing loads from other sites, and the page can only talk to BNB Smart Chain RPC.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://bsc-dataseed.bnbchain.org https://bsc-dataseed1.bnbchain.org https://bsc-rpc.publicnode.com; object-src 'none'; base-uri 'self'; form-action 'none'; require-trusted-types-for 'script'"
export default defineConfig(({ mode }) => ({
  base: mode === 'preview' ? './' : '/',
  plugins: [react(), tailwind(), ...(mode === 'preview' ? [] : [{ name: 'csp-meta', transformIndexHtml: (html: string) => html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`) }]), { name: 'no-outside-urls', renderChunk: (code: string) => code.replace(/https:\/\/(docs\.soliditylang\.org|gsap\.com)/g, '$1') }],
  build: { target: 'es2020', chunkSizeWarningLimit: 700 },
}))
