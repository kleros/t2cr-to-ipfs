import 'typescript'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN_DECIMALS_VIEW_ADDRESS: string
      T2CR_GRAPH_URL: string
      T2CR_ADDRESS: string
      ERC20_BADGE_ADDRESS: string
      STABLECOIN_BADGE_ADDRESS: string
      TRUECRYPTOSYSTEM_BADGE_ADDRESS: string
      DUTCHX_BADGE_ADDRESS: string
      PROVIDER_URL: string
      POLL_PERIOD_SECONDS: string
      LATEST_TOKEN_LIST_URL: string
      LATEST_NFT_LIST_URL: string
      IPFS_GATEWAY: string
      PINATA_API_KEY: string
      PINATA_SECRET_API_KEY: string
      WALLET_KEY: string
      ENS_CONTRACT: string
      ENS_TOKEN_LIST_NAME: string
      ENS_NFT_LIST_NAME: string
      TOKEN_DECIMALS_TCR_ADDRESS: string
      GTCR_VIEW_ADDRESS: string
    }
  }
}
