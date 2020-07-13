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

if (!process.env.LIST_LOGO_URI) {
  throw new Error(
    'List logo URI not set. Please set the LIST_LOGO_URI environment variable in the format /ipfs/${path}. Example.: /ipfs/QmUSNbwUxUYNMvMksKypkgWs8unSm8dX2GjCPBVGZ7GGMr',
  )
}
