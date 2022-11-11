import { ethers } from 'ethers'
import { TokenInfo } from '@uniswap/token-lists'

import { TokenDecimalsViewABI } from '../abis'
import axios from 'axios'

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
  const registryResponse = await axios.post(
    process.env.T2CR_GRAPH_URL,
    JSON.stringify({
      query: `
      {
        registries {
          numberOfSubmissions
        }
      }
    `,
    }),
    {
      responseType: 'json',
    },
  )
  const {
    data: {
      data: { registries },
    },
  } = registryResponse || {}
  const registry = registries[0]
  const { numberOfSubmissions } = registry
  const rounds = Math.ceil(numberOfSubmissions / 1000)

  let tokensFromSubgraph: TokenFromSubgraph[] = []

  for (let i = 0; i < rounds; i++) {
    const registeredResponse = await axios.post(
      process.env.T2CR_GRAPH_URL,
      JSON.stringify({
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
      {
        responseType: 'json',
      },
    )

    const {
      data: {
        data: { tokens: registeredTokens },
      },
    } = registeredResponse || {}
    tokensFromSubgraph = tokensFromSubgraph.concat(registeredTokens)
  }

  const clearingRequestedResponse = await axios.post(
    process.env.T2CR_GRAPH_URL,
    JSON.stringify({
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
    {
      responseType: 'json',
    },
  )

  const {
    data: {
      data: { tokens: clearingRequestedTokens },
    },
  } = clearingRequestedResponse || {}
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
