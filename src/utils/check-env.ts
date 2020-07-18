export default function checkEnvs(): void {
  if (!process.env.PROVIDER_URL) {
    throw new Error(
      'No web3 provider set. Please set the PROVIDER_URL environment variable',
    )
  }

  if (!process.env.TOKENS_VIEW_ADDRESS) {
    throw new Error(
      'Tokens view contract address not set. Please set the TOKENS_VIEW_ADDRESS environment variable',
    )
  }

  if (!process.env.BADGE_ADDRESS) {
    throw new Error(
      'Badge contract address not set. Please set the BADGE_ADDRESS environment variable',
    )
  }

  if (!process.env.T2CR_ADDRESS) {
    throw new Error(
      'T2CR contract address not set. Please set the T2CR_ADDRESS environment variable',
    )
  }

  if (!process.env.IPFS_GATEWAY) {
    throw new Error(
      'IPFS gateway URL not set. Please set the IPFS_GATEWAY environment variable',
    )
  }

  if (!process.env.LATEST_LIST_URL) {
    throw new Error(
      'Latest list URL not set. Please set the LATEST_LIST_URL environment variable',
    )
  }

  if (!process.env.WALLET_KEY) {
    throw new Error(
      'Latest list URL not set. Please set the LATEST_LIST_URL environment variable',
    )
  }

  if (!process.env.ENS_CONTRACT) {
    throw new Error(
      'Latest list URL not set. Please set the LATEST_LIST_URL environment variable',
    )
  }

  if (!process.env.ENS_LIST_NAME) {
    throw new Error(
      'Missing ens name for list. Please set the ENS_LIST_NAME environment variable',
    )
  }
}
