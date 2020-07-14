import dotenv from 'dotenv'
import { ethers } from 'ethers'
import { TokenList, TokenInfo, schema, Version } from '@uniswap/token-lists'
import Ajv from 'ajv'
import { isEqual } from 'lodash'
import { TextEncoder } from 'util'
import fetch from 'node-fetch'

import { BadgeABI, TokensViewABI, ERC20ABI } from './abis'
import { Token } from './types/global'
import { getNewVersion, ipfsPublish, checkEnv } from './utils'

dotenv.config({ path: '.env' })
checkEnv()

const ajv = new Ajv({ allErrors: true, format: 'full' })
const validator = ajv.compile(schema)
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
  console.info()
  console.info('Running...')
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
  console.info('Fetching tokens...')
  const fetchedTokens: TokenInfo[] = (
    await tokensView.getTokens(process.env.T2CR_ADDRESS, tokenIDs)
  )
    .filter((tokenInfo: Token) => tokenInfo.addr !== ZERO_ADDRESS)
    .map((token: Token) => ({
      chainId,
      address: ethers.utils.getAddress(token.addr),
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
  const missingDecimals: TokenInfo[] = fetchedTokens.filter(
    (token: TokenInfo) => token.decimals === 0,
  )

  const tokens = fetchedTokens.filter(
    (token: TokenInfo) => token.decimals !== 0,
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

  const latestList: TokenList = await (
    await fetch(process.env.LATEST_LIST_URL)
  ).json()

  // Ensure addresses of the fetched lists are normalized.
  latestList.tokens = latestList.tokens.map((token) => ({
    ...token,
    address: ethers.utils.getAddress(token.address),
  }))

  const version: Version = getNewVersion(latestList, tokens)

  if (isEqual(latestList.version, version)) {
    // List did not change. Stop here.
    console.info('List did not change.')
    console.info()
    return
  }

  // Build the JSON object.
  const tokenList: TokenList = {
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
  }

  // TODO: Enable validator after logoURIs are less than 20 chars, formated and pointing to 64x64 images.
  // if (!validator(tokenList)) {
  //   console.error('Validation errors: ', validator.errors)
  //   throw new Error(`Could not validate generated list ${tokenList}`)
  // }

  const data = new TextEncoder().encode(JSON.stringify(tokenList, null, 2))
  const ipfsResponse = await ipfsPublish('mainnet.t2cr.tokenlist.json', data)
  const URI = `/ipfs/${ipfsResponse[1].hash + ipfsResponse[0].path}`

  // TODO: Update ens to point to new token list.
}

main()
