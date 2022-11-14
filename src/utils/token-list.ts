import axios from 'axios'
import Ajv, { JSONSchemaType } from 'ajv'
import addFormats from 'ajv-formats'

import { TokenList, Version, TokenInfo } from '@uniswap/token-lists/dist/types'
import {
  CollectibleList,
  CollectibleInfo,
} from '@0xsequence/collectible-lists/dist/types'

const ajv = new Ajv({
  allErrors: true,
  $data: true,
  verbose: true,
})
addFormats(ajv)

type CollectibleOrTokenList<
  T extends CollectibleInfo[] | TokenInfo[]
> = T extends CollectibleInfo[] ? CollectibleList : TokenList

const generate = <T extends CollectibleInfo[] | TokenInfo[]>(
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

export const fetch = async <T>(url: string): Promise<T> => {
  return (
    await axios.get(url, {
      headers: {
        pragma: 'no-cache',
        'cache-control': 'no-cache',
      },
      responseType: 'json',
    })
  ).data
}

const validate = (schema: any, dataList: CollectibleList | TokenList): void => {
  const validator = ajv.compile(schema)
  if (!validator(dataList)) {
    console.error('Validation errors encountered.')
    if (validator.errors)
      validator.errors.map((err: unknown) => {
        console.error(err)
      })
    throw new Error(`Could not validate generated list ${dataList}`)
  }
}

export default { fetch, generate, validate }
