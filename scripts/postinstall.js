const { execSync } = require('child_process');

try {
  if (!process.env.DATABASE_URL) {
    console.log('[postinstall] Skipping prisma generate: DATABASE_URL not set');
    process.exit(0);
  }
  console.log('[postinstall] Running prisma generate');
  execSync('prisma generate', { stdio: 'inherit' });
} catch (e) {
  console.warn('[postinstall] prisma generate failed:', e?.message || e);
  // Jangan gagalkan build; generate akan dijalankan lagi di start
  process.exit(0);
}