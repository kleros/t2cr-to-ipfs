import dotenv from 'dotenv'

import { BadgeABI, TokensViewABI } from './abis'
import { ethers } from 'ethers'
import { Token } from './types/global'

dotenv.config({ path: '.env' })
import './utils/env-check'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FILTER = [
  false, // Do not include items which are not on the TCR.
  true, // Include registered items.
  false, // Do not include items with pending registration requests.
  true, // Include items with pending removal requests.
  false, // Do not include items with challenged registration requests.
  true, // Include items with challenged removal requests.
  false, // Include token if caller is the author of a pending request (not used).
  false, // Include token if caller is the challenger of a pending request (not used).
]

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )
  provider.pollingInterval =
    Number(process.env.POLL_PERIOD_SECONDS) || 60 * 1000 // Poll every minute.

  const badgeContract = new ethers.Contract(
    process.env.BADGE_ADDRESS || '',
    BadgeABI,
    provider,
  )

  // We use a view contract to return token data
  // efficiently.
  const tokensView = new ethers.Contract(
    process.env.TOKENS_VIEW_ADDRESS || '',
    TokensViewABI,
    provider,
  )

  // Fetch addresses of tokens that have the badge.
  const addressesWithBadge = new Set()
  let hasMore = true
  let cursor = ZERO_ADDRESS
  while (hasMore) {
    console.info('Cursor:', cursor)
    console.info('Fetching...')
    const response = await badgeContract.queryAddresses(
      cursor, // A token address to start/end the query from. Set to zero means unused.
      200, // Number of items to return at once.
      FILTER,
      true, // Return oldest first.
    )

    hasMore = response.hasMore

    // Since the contract returns fixed sized arrays, we must filter out unused items.
    const addresses = response[0].filter(
      (address: string) => address !== ZERO_ADDRESS,
    )

    addresses.forEach((address: string) => addressesWithBadge.add(address))
    cursor = addresses[addresses.length - 1]
  }
  console.info('Fetched addresses.')
  console.info('Fetching token IDs for addresses')

  // Fetch their submission IDs on the T2CR.
  const submissionIDs = await tokensView.getTokensIDsForAddresses(
    process.env.T2CR_ADDRESS,
    Array.from(addressesWithBadge),
  )

  // With the token IDs, get the information and add it to the object.
  const fetchedTokens = (
    await tokensView.getTokens(process.env.T2CR_ADDRESS, submissionIDs)
  )
    .filter((tokenInfo: Token) => tokenInfo.addr !== ZERO_ADDRESS)
    .reduce(
      (acc: any, curr: Token) => ({
        ...acc,
        [curr.addr]: curr,
      }),
      {},
    )

  // The `decimals()` function of the ERC20 standard is optional, so some
  // token contracts (e.g. DigixDAO/DGD) do not implement it.
  // In this cases, the tokensView.getTokens returns 0 in the decimals
  // field of token struct.
  // We'll test all tokens with 0 decimals to detect which ones
  // do not implement and handle them separately.
  const missingDecimals = fetchedTokens.filter(
    (token: Token) => token.decimals.toNumber() === 0,
  )

  // TODO: Deploy a TCR of tokens -> decimals. Use Generalized TCRs for that.
  // TODO: Submit tokens that do not implement the `decimals` function there.
  // TODO: Pull decimals from the TCR and merge into the response.

  const tokens = fetchedTokens.filter(
    (token: Token) => token.decimals.toNumber() !== 0,
  )

  console.info(tokens.length)
}

main()
