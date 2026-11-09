/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: 'https://izgamwrojjxjdmmbragx.supabase.co';
  readonly VITE_SUPABASE_ANON_KEY: 'sb_publishable_YGu1Z-bPM-vwqlm0shMMgw_kP1Vz67f';
  readonly VITE_APP_STORE_URL: string;
  readonly VITE_PLAY_STORE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
