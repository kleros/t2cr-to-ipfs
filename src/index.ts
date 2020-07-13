import dotenv from 'dotenv'
import { ethers } from 'ethers'

import { BadgeABI, TokensViewABI, ERC20ABI } from './abis'
import { Token, FormattedToken } from './types/global'

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

  const badge = new ethers.Contract(
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
    const response = await badge.queryAddresses(
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
  console.info(`Got ${Array.from(addressesWithBadge).length} addresses.`)
  console.info('Fetching token IDs for addresses')

  // Fetch their submission IDs on the T2CR.
  const tokenIDs = await tokensView.getTokensIDsForAddresses(
    process.env.T2CR_ADDRESS,
    Array.from(addressesWithBadge),
  )
  console.info(`Got ${tokenIDs.length} token IDs`)

  // Part of the https://uniswap.org/tokenlist.schema.json schema.
  const timestamp = new Date().toISOString()
  const chainId = (await provider.getNetwork()).chainId

  // With the token IDs, get the information and add it to the object.
  const fetchedTokens: FormattedToken[] = (
    await tokensView.getTokens(process.env.T2CR_ADDRESS, tokenIDs)
  )
    .filter((tokenInfo: Token) => tokenInfo.addr !== ZERO_ADDRESS)
    .map((token: Token) => ({
      chainId,
      address: token.addr,
      symbol: token.ticker,
      name: token.name,
      decimals: token.decimals.toNumber(),
      logoURI: token.symbolMultihash, // TODO: shrink to 64x64 pixels and upload to ipfs.
      tags: ['erc20'],
    }))

  console.info(`Got ${fetchedTokens.length} tokens.`)

  // The `decimals()` function of the ERC20 standard is optional, so some
  // token contracts (e.g. DigixDAO/DGD) do not implement it.
  // In this cases, the tokensView.getTokens returns 0 in the decimals
  // field of token struct.
  // Additionally, some tokens use a proxy contract (e.g. Synthetix/SNX)
  // which do not play well with the current implementation of the
  // view contract and also return 0 decimals.
  // We'll have to handle them separately as well.
  const missingDecimals: FormattedToken[] = fetchedTokens.filter(
    (token: FormattedToken) => token.decimals === 0,
  )

  const tokens = fetchedTokens.filter(
    (token: FormattedToken) => token.decimals !== 0,
  )

  for (const missingDecimalToken of missingDecimals) {
    try {
      const token = new ethers.Contract(
        missingDecimalToken.address,
        ERC20ABI,
        provider,
      )
      missingDecimalToken.decimals = (await token.decimals()).toNumber()
      tokens.push(missingDecimalToken)
    } catch (err) {
      console.warn(
        `${missingDecimalToken.symbol}/${missingDecimalToken.name} @ ${missingDecimalToken.address}, chainId ${chainId} throws when 'decimals' is called. Attempting to pull from Curate list of token decimals.`,
      )

      // TODO: Pull decimals from curate list of token decimals.
    }
  }

  // TODO: Pull the latest list from tokenlist.kleros.eth, compare the two lists and build a new version object.
  // List versions must follow the rules:
  // Increment major version when tokens are removed
  // Increment minor version when tokens are added
  // Increment patch version when tokens already on the list have minor details changed (name, symbol, logo URL)
  // Changing a token address or chain ID is considered both a remove and an add, and should be a major version update.
  const version = {
    major: 1,
    minor: 0,
    patch: 0,
  }

  // Build the JSON object.
  const tokenList = {
    name: 'Kleros T2CR Token List',
    keywords: ['t2cr', 'kleros', 'list'],
    timestamp,
    version,
    tags: {
      erc20: {
        name: 'ERC20 Badge',
        description: 'Tokens that were awarded the Kleros ERC20 Badge.',
      },
    },
    tokens,
    logoURI: `ipfs://${process.env.LIST_LOGO_URI.slice('/ipfs/'.length)}`,
  }

  // TODO: Upload to ipfs
  // TODO: Update ens to point to new token list.
}

main()
