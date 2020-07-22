import dotenv from 'dotenv'
import { ethers } from 'ethers'
import { TokenList, TokenInfo, schema, Version } from '@uniswap/token-lists'
import Ajv from 'ajv'
import { isEqual } from 'lodash'
import { TextEncoder } from 'util'
import fetch from 'node-fetch'
import sharp from 'sharp'
import { abi as resolverABI } from '@ensdomains/resolver/build/contracts/Resolver.json'
import namehash from 'eth-ens-namehash'
import { encode } from 'content-hash'
import pinataSDK from '@pinata/sdk'
import { GeneralizedTCR } from '@kleros/gtcr-sdk'

import { ERC20ABI } from './abis'
import {
  getNewVersion,
  ipfsPublish,
  checkEnv,
  getTokens,
  getAddressesWithBadge,
} from './utils'

dotenv.config({ path: '.env' })
checkEnv()

const ajv = new Ajv({ allErrors: true, format: 'full' })
const validator = ajv.compile(schema)

async function main() {
  console.info()
  console.info('Running...')
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )
  provider.pollingInterval =
    Number(process.env.POLL_PERIOD_SECONDS) || 60 * 1000 // Poll every minute.

  // Initialize pinata.cloud if keys were provided.
  let pinata
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY) {
    pinata = pinataSDK(
      process.env.PINATA_API_KEY,
      process.env.PINATA_SECRET_API_KEY,
    )
    console.info(
      'Pinata authentication test',
      await pinata.testAuthentication(),
    )
  }

  const timestamp = new Date().toISOString()
  const chainId = (await provider.getNetwork()).chainId

  console.info('Fetching tokens...')
  const fetchedTokens: TokenInfo[] = await getTokens(provider, chainId)

  console.info(
    `Got ${fetchedTokens.length} tokens. Shrinking and uploading token logos...`,
  )

  // Doing this synchronously to avoid DoSing the node (might not be required anymore).
  let i = 0
  for (const token of fetchedTokens) {
    console.info(`${++i} of ${fetchedTokens.length}`)
    const imageBuffer = await (
      await fetch(`${process.env.IPFS_GATEWAY}${token.logoURI}`)
    ).buffer()

    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(64, 64)
      .png()
      .toBuffer()

    console.info(`Uploading shrunk image to ${process.env.IPFS_GATEWAY}`)
    const ipfsResponse = await ipfsPublish(
      `${token.symbol}.png`,
      resizedImageBuffer,
    )
    token.logoURI = `ipfs://${ipfsResponse[0].hash}`
    if (pinata) {
      console.info('Pinning image on pinata.cloud...')
      try {
        await pinata.pinByHash(ipfsResponse[0].hash)
        console.info('Done...')
      } catch (err) {
        console.error(err)
      }
    }
  }

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

  const gtcr = new GeneralizedTCR(
    provider,
    process.env.TOKEN_DECIMALS_ADDRESS || '',
    process.env.GTCR_VIEW_ADDRESS,
    process.env.IPFS_GATEWAY,
  )

  const tokenDecimals = await gtcr.getItems()

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

      for (const entry of tokenDecimals) {
        if (
          ((entry.resolved === true && entry.status === 1) ||
            (!entry.resolved && entry.status === 3)) &&
          ethers.utils.getAddress(entry.decodedData[0]) ===
            missingDecimalToken.address
        ) {
          missingDecimalToken.decimals = entry.decodedData[1].toNumber()
          tokens.push(missingDecimalToken)
          console.info(
            `Got decimal places from list: ${missingDecimalToken.decimals}`,
          )
          break
        }
      }
    }
  }

  // Fetch token addresses with the badge
  const tokensWithBadge = await getAddressesWithBadge(
    process.env.BADGE_ADDRESS || '',
    provider,
  )

  tokensWithBadge.forEach((tokenAddr) => {
    tokens.forEach((token) => {
      if (token.address === tokenAddr) token.tags?.push('erc20')
    })
  })

  console.info(
    'Tokens with the ERC20 badge',
    tokens.filter((t) => t.tags && t.tags.includes('erc20')).length,
  )

  console.info('Pulling latest list...')
  const latestList: TokenList = await (
    await fetch(process.env.LATEST_LIST_URL || '')
  ).json()
  console.info('Done.')

  // Ensure addresses of the fetched lists are normalized.
  latestList.tokens = latestList.tokens.map((token) => ({
    ...token,
    address: ethers.utils.getAddress(token.address),
  }))

  const version: Version = getNewVersion(latestList, tokens)

  if (isEqual(latestList.version, version)) {
    // List did not change. Stop here.
    console.info('List did not change.')
    console.info('Latest list can be found at', process.env.LATEST_LIST_URL)
    return
  }

  // Build the JSON object.
  const tokenList: TokenList = {
    name: 'Kleros T2CR',
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

  if (!validator(tokenList)) {
    console.error('Validation errors: ', validator.errors)
    throw new Error(`Could not validate generated list ${tokenList}`)
  }

  console.info('Uploading to IPFS...')
  const data = new TextEncoder().encode(JSON.stringify(tokenList, null, 2))
  const ipfsResponse = await ipfsPublish('t2cr.tokenlist.json', data)
  const contentHash = ipfsResponse[0].hash
  console.info(`Done. ${process.env.IPFS_GATEWAY}/ipfs/${contentHash}`)

  if (pinata) {
    console.info('Pinning list in pinata.cloud...')
    await pinata.pinByHash(contentHash)
    console.info('Done.')
  }

  // As of v5.0.5, Ethers ENS API doesn't include managing ENS names, so we
  // can't use directly. Neither does the ethjs API.
  // Web3js supports it via web3.eth.ens but it can't sign transactions
  // locally and send them via eth_sendRawTransaction, which means it can't
  // be used with Ethereum endpoints that don't support
  // eth_sendTransaction (e.g. Infura). We'll have to interact with the
  // contracts directly.
  const signer = new ethers.Wallet(process.env.WALLET_KEY || '', provider)
  const ensName = namehash.normalize(process.env.ENS_LIST_NAME || '')
  const resolver = new ethers.Contract(
    await provider._getResolver(ensName),
    resolverABI,
    signer,
  )
  const ensNamehash = namehash.hash(ensName)
  const encodedContentHash = `0x${encode('ipfs-ns', contentHash)}`
  console.info()
  console.info('Updating ens entry...')
  await resolver.setContenthash(ensNamehash, encodedContentHash)
  console.info(
    `Done. List available at ${process.env.IPFS_GATEWAY}/ipfs/${contentHash}`,
  )
}

main()
