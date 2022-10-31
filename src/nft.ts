import {
  schema,
  CollectibleInfo,
  CollectibleList,
  Version,
} from '@0xsequence/collectible-lists'
import { isEqual } from 'lodash'
import { ethers } from 'ethers'
import namehash from 'eth-ens-namehash'
import { encode } from 'content-hash'
import { TextEncoder } from 'util'
import { abi as resolverABI } from '@ensdomains/resolver/build/contracts/Resolver.json'

import { ipfsPublish } from './utils'
import { getNewNFTListVersion } from './versioning'
import { validateCollectibleList } from './utils/validate-collectible-list'
import { fetchList, generateTokenList } from './utils/generate-token-list'
import { getContractInstance } from './utils/get-contract-instance'

export default async function checkPublishNFT(
  latestTokens: CollectibleInfo[],
  pinata: any,
  provider: ethers.providers.JsonRpcProvider,
  listURL = '',
  ensListName = '',
  listName: string,
  fileName: string,
): Promise<void> {
  const timestamp = new Date().toISOString()
  console.info(`Pulling latest list from ${listURL}`)

  let previousList: CollectibleList = await fetchList(listURL)
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
    .filter((t) => {
      if (!nameRe.test(t.name)) {
        console.warn(` ${t.name} failed name regex test, dropping it.`)
        invalidTokens.push(t)
        return false
      }
      if (t.name.length > 40) {
        console.warn(` ${t.name} longer than 40 chars, dropping it.`)
        invalidTokens.push(t)
        return false
      }
      return true
    })
    .filter((t) => {
      if (!tickerRe.test(t.symbol)) {
        console.warn(` ${t.symbol} failed ticker regex test, dropping it.`)
        invalidTokens.push(t)
        return false
      }
      return true
    })

  const version: Version = getNewNFTListVersion(
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
  const tokenList: CollectibleList = generateTokenList(
    listName,
    timestamp,
    version,
    validatedTokens,
  )

  validateCollectibleList(schema, tokenList)

  console.info('Uploading to IPFS...')
  const data = new TextEncoder().encode(JSON.stringify(tokenList, null, 2))
  const ipfsResponse = await ipfsPublish(fileName, data)
  const contentHash = ipfsResponse[0].hash
  console.info(`Done. ${process.env.IPFS_GATEWAY}/ipfs/${contentHash}`)

  if (pinata) {
    console.info('Pinning list in pinata.cloud...')
    await pinata.pinByHash(contentHash)
    console.info('Done.')
  }

  // As of v5.0.5, Ethers ENS API doesn't include managing ENS names, so we
  // can't use it directly. Neither does the ethjs API.
  // Web3js supports it via web3.eth.ens but it can't sign transactions
  // locally and send them via eth_sendRawTransaction, which means it can't
  // be used with Ethereum endpoints that don't support
  // eth_sendTransaction (e.g. Infura).
  //
  // We'll have to interact with the contracts directly.
  //const signer = new ethers.Wallet(process.env.WALLET_KEY || '', provider)
  const ensName = namehash.normalize(ensListName)
  const ensNamehash = namehash.hash(ensName)

  const [signer, resolver] = await getContractInstance(
    ensName,
    resolverABI,
    provider,
  )

  const encodedContentHash = `0x${encode('ipfs-ns', contentHash)}`
  console.info()
  console.info('Updating ens entry...')
  console.info(`Manager: ${await signer.getAddress()}`)
  await resolver.setContenthash(ensNamehash, encodedContentHash)
  console.info(
    `Done. List available at ${process.env.IPFS_GATEWAY}/ipfs/${contentHash}`,
  )
}
