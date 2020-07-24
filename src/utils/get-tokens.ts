import { TokensViewABI } from '../abis'
import { ethers } from 'ethers'
import { Token } from '../types/token'
import { TokenInfo } from '@uniswap/token-lists'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FILTER = [
  false, // Do not include absent items (e.g. items that were rejected or that were accepted but later removed).
  true, // Include registered items.
  false, // Do not include items with pending registration requests.
  true, // Include items with pending removal requests.
  false, // Do not include items with challenged registration requests.
  true, // Include items with challenged removal requests.
]

/**
 * Fetch all tokens from the T2CR.
 */
export default async function getTokens(
  provider: ethers.providers.JsonRpcProvider,
  chainId: number,
): Promise<TokenInfo[]> {
  // We use a view contract to return token data
  // efficiently.
  const tokensView = new ethers.Contract(
    process.env.TOKENS_VIEW_ADDRESS || '',
    TokensViewABI,
    provider,
  )

  const count = 300
  const tokens = new Map()
  let hasMore = true
  let cursor = 0
  while (hasMore) {
    console.info('Cursor:', cursor)
    const response = await tokensView.getTokensCursor(
      process.env.T2CR_ADDRESS || '',
      cursor, // The token from where to start iterating.
      count, // Number of items to return at once.
      FILTER,
    )

    hasMore = response.hasMore
    const tokensBatch = response.tokens
      .filter((tokenInfo: Token) => tokenInfo.addr !== ZERO_ADDRESS)
      .map((token: Token) => ({
        chainId,
        address: ethers.utils.getAddress(token.addr),
        symbol: token.ticker,
        name: token.name,
        decimals: token.decimals.toNumber(),
        logoURI: token.symbolMultihash,
        tags: [],
      }))

    tokensBatch.forEach((token: TokenInfo) => tokens.set(token.address, token))
    cursor = cursor + count
  }
  return Array.from(tokens.values())
}
