import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  timeout:30000,
  expect:{timeout:7000},
  fullyParallel:false,
  retries:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    trace:'retain-on-failure'
  },
  webServer:{
    command:'node scripts/e2e-server.mjs',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:false,
    timeout:15000
  }
});
