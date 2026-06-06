import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable.png'],
      manifest: {
        id: '/respond-dispatch',
        name: 'RESPOND Dispatch',
        short_name: 'RESPOND',
        description: 'Multi-agency emergency dispatch system for Fire, Police, EMT, and CERT teams.',
        theme_color: '#0c0d11',
        background_color: '#08090c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-US',
        dir: 'ltr',
        categories: ['utilities', 'productivity', 'communication'],
        prefer_related_applications: false,
        icons: [
          { src: 'icon-192.png',     sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png',     sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png',sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'RESPOND Dispatch Screen',
          },
        ],
        shortcuts: [
          {
            name: 'Alerts',
            short_name: 'Alerts',
            url: '/?tab=alerts',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Dispatch',
            short_name: 'Dispatch',
            url: '/?tab=dispatch',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
