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
  const registryResponse = await fetch(process.env.T2CR_GRAPH_URL, {
    method: 'POST',
    body: JSON.stringify({
      query: `
        {
          registries {
            numberOfSubmissions
          }
        }
      `,
    }),
  })

  const {
    data: { registries },
  } = (await registryResponse.json()) || {}
  const registry = registries[0]
  const { numberOfSubmissions } = registry
  const rounds = Math.ceil(numberOfSubmissions / 1000)

  let tokensFromSubgraph: TokenFromSubgraph[] = []

  for (let i = 0; i < rounds; i++) {
    const registeredResponse = await fetch(process.env.T2CR_GRAPH_URL, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          {
            tokens(skip: ${
              i * 1000
            }, first: 1000, where: { status: Registered }) {
              name
              ticker
              address
              symbolMultihash
            }
          }
        `,
      }),
    })

    const {
      data: { tokens: registeredTokens },
    } = (await registeredResponse.json()) || {}
    tokensFromSubgraph = tokensFromSubgraph.concat(registeredTokens)
  }

  const clearingRequestedResponse = await fetch(process.env.T2CR_GRAPH_URL, {
    method: 'POST',
    body: JSON.stringify({
      query: `
        {
          tokens(where: { status: ClearingRequested }) {
            name
            ticker
            address
            symbolMultihash
          }
        }
      `,
    }),
  })
  const {
    data: { tokens: clearingRequestedTokens },
  } = (await clearingRequestedResponse.json()) || {}
  tokensFromSubgraph = tokensFromSubgraph.concat(clearingRequestedTokens)
  tokensFromSubgraph = tokensFromSubgraph.map((t: TokenFromSubgraph) => ({
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
