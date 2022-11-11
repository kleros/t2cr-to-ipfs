import {
  schema,
  CollectibleInfo,
  CollectibleList,
  Version,
} from '@0xsequence/collectible-lists'
import { isEqual } from 'lodash'
import { ethers } from 'ethers'
import { abi as resolverABI } from '@ensdomains/resolver/build/contracts/Resolver.json'

import estuaryRequest from './api/estuary-api'
import { getListVersion } from './versioning'
import { updateEnsEntry, tokenListUtils } from './utils'

export default async function checkPublishNFT(
  latestTokens: CollectibleInfo[],
  provider: ethers.providers.JsonRpcProvider,
  listURL = '',
  ensListName = '',
  listName: string,
  fileName: string,
): Promise<void> {
  const timestamp = new Date().toISOString()
  console.info(`Pulling latest list from ${listURL}`)

  let previousList: CollectibleList = await tokenListUtils.fetch(listURL)
  console.info('Done.')

  // Ensure addresses of the fetched lists are normalized.
  previousList = {
    ...previousList,
    tokens: previousList.tokens.map((token) => ({
      ...token,
      address: ethers.utils.getAddress(token.address),
    })),
  }

  // Invalid names or tickers should not prevent a new list from being published.
  const nameRe = new RegExp(
    schema.definitions.TokenInfo.properties.name.pattern,
  )
  const tickerRe = new RegExp(
    schema.definitions.TokenInfo.properties.symbol.pattern,
  )
  const invalidTokens: CollectibleInfo[] = []
  const validatedTokens = latestTokens
    .filter((token) => {
      if (!nameRe.test(token.name)) {
        console.warn(` ${token.name} failed name regex test, dropping it.`)
        invalidTokens.push(token)
        return false
      }
      if (token.name.length > 40) {
        console.warn(` ${token.name} longer than 40 chars, dropping it.`)
        invalidTokens.push(token)
        return false
      }
      return true
    })
    .filter((token) => {
      if (!tickerRe.test(token.symbol)) {
        console.warn(` ${token.symbol} failed ticker regex test, dropping it.`)
        invalidTokens.push(token)
        return false
      }
      return true
    })

  const version: Version = getListVersion(
    previousList,
    latestTokens,
    invalidTokens,
  )
  if (isEqual(previousList.version, version)) {
    // List did not change. Stop here.
    console.info('List did not change.')
    console.info(
      'Latest list can be found at',
      process.env.LATEST_TOKEN_LIST_URL,
    )
    return
  } else {
    console.info('List changed.')
  }

  // Build the JSON object.
  const tokenList: CollectibleList = tokenListUtils.generate(
    listName,
    timestamp,
    version,
    validatedTokens,
  )

  tokenListUtils.validate(schema, tokenList)

  console.info('Uploading to Estuary...')
  const bufferTokenList = Buffer.from(JSON.stringify(tokenList))
  const estuaryResponse = await estuaryRequest.uploadFile(
    fileName,
    bufferTokenList,
  )
  console.info(`Done. ${estuaryResponse.retrieval_url}`)

  await updateEnsEntry(ensListName, estuaryResponse.cid, resolverABI, provider)
}
