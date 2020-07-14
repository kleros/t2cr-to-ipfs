import 'typescript'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      T2CR_ADDRESS: string
      BADGE_ADDRESS: string
      TOKENS_VIEW_ADDRESS: string
      PROVIDER_URL: string
      POLL_PERIOD_SECONDS: string
      LATEST_LIST_URL: string
      IPFS_GATEWAY: string
    }
  }
}
