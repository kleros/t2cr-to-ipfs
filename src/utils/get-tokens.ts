import { ethers } from 'ethers'
import fetch from 'node-fetch'
import { TokenInfo } from '@uniswap/token-lists'

export interface Prop {
  label: string
  value: string
}

export interface Item {
  metadata : {
    props: Prop[]
  } | null
  id: string
}

const fetchTokensBatch = async (id: string): Promise<Item[]> => {
  const subgraphQuery = {
    query: `
      {
        litems(where: {
          registryAddress: "${process.env.KLEROS_TOKENS_REGISTRY_ADDRESS}",
          status_in: [Registered, ClearingRequested],
          id_gt: "${id}"
        }, first: 1000) {
          id
          metadata {
            props {
              label
              value
            }
          }
        }
      }
    `,
  }
  const response = await fetch(
    'https://api.studio.thegraph.com/query/61738/legacy-curate-gnosis/version/latest',
    {
      method: 'POST',
      body: JSON.stringify(subgraphQuery),
    },
  )

  const { data } = await response.json()
  const tags: Item[] = data.litems

  return tags
}

const fetchAllTokens = async () => {
  const batches = []
  let lastId = ''
  for (let i = 0; i < 1000; i++) {
    console.log('Tokens batch', batches.length)
    const batch = await fetchTokensBatch(lastId)
    console.log('Batch got length:', batch.length)
    batches.push(batch)
    if (batch.length < 1000) break
    lastId = batch[999].id
  }
  const flatTokens: Item[] = []
  for (const batch of batches) {
    for (const item of batch) {
      flatTokens.push(item)
    }
  }
  console.log('Total tokens fetched: ', flatTokens.length)
  return flatTokens
}

/**
 * Fetch all tokens from the T2CR.
 */
export default async function getTokens(): Promise<TokenInfo[]> {
  const tokensFromSubgraph = await fetchAllTokens()

  // This script used to check views to figure out the decimals,
  // but since the decimals are currently curated, that is no longer necessary.

  const nonEvmTokens: string[] = []
  const dupeTokens: string[] = []

  const tokens: Map<string, TokenInfo> = new Map()
  for (const token of tokensFromSubgraph) {
    const caipAddress = token?.metadata?.props.find((p) => p.label === 'Address')
      ?.value as string
    const name = token?.metadata?.props.find((p) => p.label === 'Name')?.value as string
    const symbol = token?.metadata?.props.find((p) => p.label === 'Symbol')
      ?.value as string
    const logo = token?.metadata?.props.find((p) => p.label === 'Logo')?.value as string
    const decimals = token?.metadata?.props.find((p) => p.label === 'Decimals')
      ?.value as string

    const [namespace] = caipAddress.split(':')
    if (namespace !== 'eip155') {
      nonEvmTokens.push(caipAddress)
      continue // Non-EVM contracts are out for the time being
    }
    const matchToken = tokens.get(caipAddress.toLowerCase())
    if (matchToken) {
      dupeTokens.push(caipAddress)
    }
    const [, chainId, address] = caipAddress.split(':')

    tokens.set(caipAddress.toLowerCase(), {
      chainId: Number(chainId),
      address: ethers.utils.getAddress(address),
      symbol: symbol,
      name: name,
      decimals: Number(decimals),
      logoURI: logo,
    })
  }

  console.log('Non-evm tokens: ', nonEvmTokens.length)
  console.log('Dupe tokens: ', dupeTokens.length, dupeTokens)
  console.log('=================')

  return Array.from(tokens.values())
}
