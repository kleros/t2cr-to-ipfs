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
      PINATA_API_KEY: string
      PINATA_SECRET_API_KEY: string
      WALLET_KEY: string
      ENS_CONTRACT: string
      ENS_LIST_NAME: string
      TOKEN_DECIMALS_ADDRESS: string
      GTCR_VIEW_ADDRESS: string
    }
  }
}
