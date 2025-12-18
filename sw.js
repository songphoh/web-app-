// Basic Service Worker for NithanAI PWA
const CACHE_NAME = 'nithan-ai-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests - basic implementation to allow installation
  event.respondWith(fetch(event.request));
});