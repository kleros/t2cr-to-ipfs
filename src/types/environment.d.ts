import 'typescript'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CURATE_GRAPH_URL: string
      KLEROS_TOKENS_REGISTRY_ADDRESS: string
      PROVIDER_URL: string
      POLL_PERIOD_SECONDS: string
      LATEST_T2CRTOKENS_URL: string
      LATEST_TOKENLIST_URL: string
      IPFS_GATEWAY: string
      WALLET_KEY: string
      ENS_CONTRACT: string
      ENS_T2CRTOKENS_NAME: string,
      ENS_TOKENLIST_NAME: string
    }
  }
}
