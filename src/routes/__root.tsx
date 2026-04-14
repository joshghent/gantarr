import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Gantarr',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
    ],
  }),
  shellComponent: RootDocument,
})

// Polyfill esbuild's __name helper on the client. Wrangler re-bundles
// the TanStack Start server with keepNames: true, which wraps functions
// in __name(fn, "name"). Seroval then serializes those functions to the
// streaming-SSR inline scripts via fn.toString(), so the wrapped source
// (including the __name call) ends up running in the browser — where
// __name is undefined and hydration blows up. A no-op shim is enough.
const NAME_SHIM =
  'window.__name=window.__name||function(f,n){try{Object.defineProperty(f,"name",{value:n,configurable:true})}catch(e){}return f}'

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline shim */}
        <script dangerouslySetInnerHTML={{ __html: NAME_SHIM }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
