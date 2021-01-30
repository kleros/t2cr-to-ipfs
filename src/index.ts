import dotenv from 'dotenv-safe'
import { ethers } from 'ethers'
import { TokenInfo } from '@uniswap/token-lists'
import fetch from 'node-fetch'
import sharp from 'sharp'
import pinataSDK from '@pinata/sdk'
import { GeneralizedTCR } from '@kleros/gtcr-sdk'
import fs from 'fs'
import IpfsOnlyHash from 'ipfs-only-hash'

dotenv.config({ path: '.env' })

import { ERC20ABI } from './abis'
import { ERC721ABI } from './abis'
import {
  ipfsPublish,
  getTokens,
  getAddressesWithBadge,
  checkPublish,
} from './utils'

console.info('Starting...')

// We include part of the multihash on the cache filename to avoid
// outdated files.
const cacheName = (multihash: string | undefined, symbol: string) =>
  multihash ? `${symbol}-` + multihash.slice(-10).replace('/', '-') : ''

async function main() {
  console.info()
  console.info('Running...')
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )
  provider.pollingInterval =
    Number(process.env.POLL_PERIOD_SECONDS) || 60 * 1000 // Poll every minute.

  // Initialize pinata.cloud if keys were provided.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pinata: any
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

  const chainId = (await provider.getNetwork()).chainId

  console.info('Fetching tokens...')
  const fetchedTokens: TokenInfo[] = await getTokens(provider, chainId)

  console.info(
    `Got ${fetchedTokens.length} tokens. Shrinking and uploading token logos...`,
  )

  // Doing this synchronously to avoid DoSing the node (might not be required anymore).
  let i = 0
  const tokensWithLogo: TokenInfo[] = []
  for (const token of fetchedTokens) {
    console.info(`${++i} of ${fetchedTokens.length}`)
    if (fs.existsSync(`images/${cacheName(token.logoURI, token.symbol)}.png`)) {
      console.info('Image available on cache.')

      const multihash = await IpfsOnlyHash.of(
        fs.readFileSync(`images/${cacheName(token.logoURI, token.symbol)}.png`),
      )

      tokensWithLogo.push({
        ...token,
        logoURI: `ipfs://${multihash}`,
      })
      continue
    }

    const imageBuffer = await (
      await fetch(`${process.env.IPFS_GATEWAY}${token.logoURI}`)
    ).buffer()

    const imageSharp = await sharp(imageBuffer).resize(64, 64).png()
    const resizedImageBuffer = await imageSharp.toBuffer()

    console.info(` Pinning shrunk image to ${process.env.IPFS_GATEWAY}`)
    let ipfsResponse

    for (let attempt = 1; attempt <= 10; attempt++)
      try {
        ipfsResponse = await ipfsPublish(
          `${token.symbol}.png`,
          resizedImageBuffer,
        )
        console.info(` Done.`)
        break
      } catch (err) {
        console.warn(` Failed to upload ${token.symbol} to gateway IPFS.`, err)
        if (attempt === 5)
          console.error(
            ` Could not upload ${token.symbol} image to gateway IPFS after 5 attempts.`,
          )
        else console.warn(` Retrying ${attempt + 1} of ${5}`)
      }

    let pinataHash
    if (pinata)
      for (let attempt = 1; attempt <= 5; attempt++) {
        console.info(` Pinning ${token.symbol} image on pinata.cloud...`)
        try {
          await imageSharp.toFile(
            `images/${cacheName(token.logoURI, token.symbol)}.png`,
          )
          const readableStream = fs.createReadStream(
            `images/${cacheName(token.logoURI, token.symbol)}.png`,
          )
          pinataHash = (await pinata.pinFileToIPFS(readableStream)).IpfsHash
          console.info(` Done.`)
          break
        } catch (err) {
          console.warn(` Failed to upload ${token.symbol} to pinnata.`, err)
          if (attempt === 5)
            console.error(
              ` Could not upload ${token.symbol} image to pinnata after 5 attempts.`,
            )
          else console.warn(` Retrying ${attempt + 1} of ${5}`)
        }
      }

    if (!ipfsResponse && !pinataHash) {
      console.error()
      throw new Error(
        `Failed to upload ${token.symbol} image to both the ipfs gateway and pinata. Halting`,
      )
    }

    tokensWithLogo.push({
      ...token,
      logoURI: `ipfs://${ipfsResponse ? ipfsResponse[0].hash : pinataHash}`,
    })
  }

  // The `decimals()` function of the ERC20 standard is optional, and some
  // token contracts (e.g. DigixDAO/DGD) do not implement it.
  // In these cases, the tokensView.getTokens returns 0 in the decimals
  // field of token struct.
  // Additionally, some tokens use a proxy contract (e.g. Synthetix/SNX)
  // which do not play well with the current implementation of the
  // view contract and also return 0 decimals.
  // We'll have to handle them separately as well.
  // It may also be the case that the number of decimals of the token is
  // actually 0, so we'll query them individually.
  //
  // Well also handle the case where the contract does not implement
  // the decimals function because it is actually an NFT token.
  const potentiallyMissingDecimals: TokenInfo[] = tokensWithLogo.filter(
    (token: TokenInfo) => token.decimals === 0,
  )

  const latestTokens: TokenInfo[] = tokensWithLogo.filter(
    (token: TokenInfo) => token.decimals !== 0,
  ) // These will be added later.

  const gtcr = new GeneralizedTCR(
    provider,
    process.env.TOKEN_DECIMALS_TCR_ADDRESS || '',
    process.env.GTCR_VIEW_ADDRESS,
    process.env.IPFS_GATEWAY,
  )

  const tokenDecimals = await gtcr.getItems()

  const nftTokens: TokenInfo[] = []
  for (const checkToken of potentiallyMissingDecimals) {
    try {
      const token = new ethers.Contract(checkToken.address, ERC20ABI, provider)
      latestTokens.push({
        ...checkToken,
        decimals: Number(await token.decimals()),
      })
    } catch (err) {
      console.warn(
        `${checkToken.symbol}/${checkToken.name} @ ${checkToken.address}, chainId ${chainId} throws when 'decimals' is called with error ${err.message}.`,
      )
      console.warn(` Checking if it is an NFT`)
      const nftToken = new ethers.Contract(
        checkToken.address,
        ERC721ABI,
        provider,
      )
      let isNFT = false
      try {
        const ERC721InterfaceSignature = '0x9a20483d'
        isNFT = await nftToken.supportsInterface(ERC721InterfaceSignature)
      } catch (error) {
        // No-op, handled in finally.
      } finally {
        if (isNFT) {
          console.info(` This is an NFT token, adding it to the list.`)
          nftTokens.push(checkToken)
          continue
        } else
          console.warn(
            ` Contract ${checkToken.address} does not implement EIP165`,
          )
      }

      console.warn(` Attempting to pull from Curate list of token decimals.`)

      for (const entry of tokenDecimals) {
        if (
          ethers.utils.getAddress(entry.decodedData[0]) !== checkToken.address
        )
          continue
        const { resolved, status } = entry
        if (resolved && status === 0) continue // Submission was rejected.
        if (!resolved && status === 2) continue // Submission was not accepted yet.

        latestTokens.push({
          ...checkToken,
          decimals: entry.decodedData[1].toNumber(),
        })
        console.info(' |')
        console.info(
          `  --Got decimal places from list: ${entry.decodedData[1].toNumber()}`,
        )
        break
      }
    }
  }

  // Add badge tags.
  const tags = {
    erc20: process.env.ERC20_BADGE_ADDRESS,
    stablecoin: process.env.STABLECOIN_BADGE_ADDRESS,
    trueCrypto: process.env.TRUECRYPTOSYSTEM_BADGE_ADDRESS,
    dutchX: process.env.DUTCHX_BADGE_ADDRESS,
  }

  const badges = await Promise.all(
    Object.entries(tags).map(async ([name, address]) => {
      return {
        [name]: await getAddressesWithBadge(address, provider),
      }
    }),
  )

  badges.forEach((badge) => {
    Object.entries(badge).forEach(([name, addresses]) => {
      addresses.forEach((address) => {
        latestTokens.concat(nftTokens).forEach((t) => {
          if (t.address === address) t.tags?.push(name)
        })
      })
    })
  })

  Object.keys(tags).map((tag) => {
    console.info(
      `Tokens with the ${tag} badge: ${
        latestTokens
          .concat(nftTokens)
          .filter((t) => t.tags && t.tags.includes(tag)).length
      }`,
    )
  })

  // Publish fungible tokens
  await checkPublish(
    latestTokens,
    pinata,
    provider,
    process.env.LATEST_TOKEN_LIST_URL,
    process.env.ENS_TOKEN_LIST_NAME,
    'Kleros Tokens',
  )

  // Publish NFTs
  await checkPublish(
    nftTokens,
    pinata,
    provider,
    process.env.LATEST_NFT_LIST_URL,
    process.env.ENS_NFT_LIST_NAME,
    'Kleros NFTs',
  )
}

main()
