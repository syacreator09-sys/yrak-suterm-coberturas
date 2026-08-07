export interface AppEnv {
  APP_ENV: 'development' | 'staging' | 'production';
  DEFAULT_TIMEZONE: string;
  DB?: D1Database;
  EVIDENCE_BUCKET?: R2Bucket;
  AI?: Ai;
}
