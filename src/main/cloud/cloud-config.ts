export const ALPHA_K_SUPABASE_PROJECT_REF = 'nuqdxhkwxlzutpdctmtb'
export const ALPHA_K_SUPABASE_REGION = 'Singapore' as const
export const ALPHA_K_AUTH_CALLBACK_URL = 'alpha-k://auth/callback'

export type CloudConfig = {
  projectRef: string
  region: typeof ALPHA_K_SUPABASE_REGION
  supabaseUrl: string
  publishableKey: string | null
  authCallbackUrl: string
}

export function readCloudConfig(
  environment: Record<string, string | undefined> = import.meta.env,
): CloudConfig {
  const configuredUrl = environment.MAIN_VITE_SUPABASE_URL?.trim()
  const configuredKey = environment.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const publishableKey =
    configuredKey && !configuredKey.includes('replace_with_your_project_key')
      ? configuredKey
      : null

  return {
    projectRef: ALPHA_K_SUPABASE_PROJECT_REF,
    region: ALPHA_K_SUPABASE_REGION,
    supabaseUrl: configuredUrl || `https://${ALPHA_K_SUPABASE_PROJECT_REF}.supabase.co`,
    publishableKey,
    authCallbackUrl: ALPHA_K_AUTH_CALLBACK_URL,
  }
}
