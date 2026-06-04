const { getSupabaseConfig } = require('./api/_shared');
const config = getSupabaseConfig();
console.log('Supabase config:', config ? '存在' : 'null');
if (config) {
  console.log('URL:', config.url?.slice(0, 30) + '...');
  console.log('Key:', config.key?.slice(0, 10) + '...');
}
