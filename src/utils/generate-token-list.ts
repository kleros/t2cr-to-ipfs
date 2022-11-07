import fetch from 'node-fetch'
import axios from 'axios'
import {
  CollectibleList,
  CollectibleInfo,
} from '@0xsequence/collectible-lists/dist/types'
import { TokenList, Version, TokenInfo } from '@uniswap/token-lists/dist/types'

type CollectibleOrTokenList<
  T extends CollectibleInfo[] | TokenInfo[]
> = T extends CollectibleInfo[] ? CollectibleList : TokenList

export const generateTokenList = <T extends CollectibleInfo[] | TokenInfo[]>(
  listName: string,
  timestamp: string,
  version: Version,
  validatedTokens: T,
): CollectibleOrTokenList<T> => {
  return {
    name: `Kleros ${listName}`,
    logoURI: 'ipfs://QmRYXpD8X4sQZwA1E4SJvEjVZpEK1WtSrTqzTWvGpZVDwa',
    keywords: ['t2cr', 'kleros', 'list'],
    timestamp,
    version,
    tags: {
      erc20: {
        name: 'ERC20',
        description: `This token is verified to be ERC20 thus there should not be incompatibility issues with the Uniswap protocol.`,
      },
      stablecoin: {
        name: 'Stablecoin',
        description: `This token is verified to maintain peg against a target.`,
      },
      trueCrypto: {
        name: 'TrueCrypto',
        description: `TrueCryptosystem verifies the token is a necessary element of a self sustaining public utility.`,
      },
      dutchX: {
        name: 'DutchX',
        description: `This token is verified to comply with the DutchX exchange listing criteria.`,
      },
    },
    tokens: validatedTokens,
  } as any
}

export const fetchList = async <T>(url: string): Promise<T> => {
  return await axios.get(url, {
    headers: {
      pragma: 'no-cache',
      'cache-control': 'no-cache',
    },
    responseType: 'json',
  })
}
