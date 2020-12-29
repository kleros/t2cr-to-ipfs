import { ethers } from 'ethers'
import fetch from 'node-fetch'
import { TokenInfo } from '@uniswap/token-lists'

import { TokenDecimalsViewABI } from '../abis'

interface TokenFromSubgraph {
  name: string
  ticker: string
  address: string
  symbolMultihash: string
}

/**
 * Fetch all tokens from the T2CR.
 */
export default async function getTokens(
  provider: ethers.providers.JsonRpcProvider,
  chainId: number,
): Promise<TokenInfo[]> {
  const response = await fetch(process.env.T2CR_GRAPH_URL, {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query Tokens {
          tokensA: tokens(first: 1000, where: { status: Registered }) {
            name
            ticker
            address
            symbolMultihash
          }
          tokensB: tokens(where: { status: ClearingRequested }) {
            name
            ticker
            address
            symbolMultihash
          }
        }
      `,
    }),
  })

  const { data } = (await response.json()) || {}
  const { tokensA, tokensB } = data || {}
  const tokensFromSubgraph: TokenFromSubgraph[] = tokensA
    .concat(tokensB)
    .map((t: TokenFromSubgraph) => ({
      ...t,
      address: ethers.utils.getAddress(t.address),
    }))

  // We use a view contract to return token decimals
  // efficiently.
  const tokensDecimalsView = new ethers.Contract(
    process.env.TOKEN_DECIMALS_VIEW_ADDRESS || '',
    TokenDecimalsViewABI,
    provider,
  )

  const tokenDecimals: number[] = (
    await tokensDecimalsView.getTokenDecimals(
      tokensFromSubgraph.map((t) => t.address),
    )
  ).map((d: ethers.BigNumber) => d.toNumber())

  const tokens: Map<string, TokenInfo> = new Map()
  tokenDecimals.forEach((decimals: number, i: number) => {
    const token = tokensFromSubgraph[i]
    tokens.set(token.address, {
      chainId,
      address: ethers.utils.getAddress(token.address),
      symbol: token.ticker,
      name: token.name,
      decimals,
      logoURI: token.symbolMultihash,
      tags: [],
    })
  })

  return Array.from(tokens.values())
}
