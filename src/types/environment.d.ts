import 'typescript'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CURATE_GRAPH_URL: string
      KLEROS_TOKENS_REGISTRY_ADDRESS: string
      PROVIDER_URL: string
      POLL_PERIOD_SECONDS: string
      LATEST_TOKEN_LIST_URL: string
      IPFS_GATEWAY: string
      WALLET_KEY: string
      ENS_CONTRACT: string
      ENS_TOKEN_LIST_NAME: string
    }
  }
}
