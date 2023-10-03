import dotenv from 'dotenv-safe'
import { ethers } from 'ethers'
import { TokenInfo } from '@uniswap/token-lists'
import fetch from 'node-fetch'
import sharp from 'sharp'
import pinataSDK from '@pinata/sdk'
import fs from 'fs'
import { Level } from 'level'

dotenv.config({ path: '.env', allowEmptyValues: true })

import { ipfsPublish, getTokens } from './utils'
import checkPublishErc20 from './erc20'

console.info('Starting...')

// We include part of the multihash on the cache filename to avoid
// outdated files.
const cacheName = (multihash: string, symbol: string) =>
  `${symbol}-` + multihash.slice(-10).replace('/', '-')

const tryGet = async (key: string, db: Level<string, string>) => {
  try {
    const value = await db.get(key)
    return value
  } catch (err) {
    return null // return null instead of crashing
  }
}

async function main() {
  const db = new Level('./db')
  console.info()
  console.info('Running...')
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )
  provider.pollingInterval =
    Number(process.env.POLL_PERIOD_SECONDS) || 60 * 1000 // Poll every minute.

  // Initialize pinata.cloud if keys were provided.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pinata: any | null
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY) {
    pinata = pinataSDK(
      process.env.PINATA_API_KEY,
      process.env.PINATA_SECRET_API_KEY,
    )
    console.info(
      'Pinata authentication test',
      await pinata.testAuthentication(),
    )
  } else {
    pinata = null
  }

  console.info('Fetching tokens...')
  const fetchedTokens: TokenInfo[] = await getTokens()

  console.info(
    `Got ${fetchedTokens.length} tokens. Shrinking and uploading token logos...`,
  )

  // Doing this synchronously to avoid DoSing the node (might not be required anymore).
  let i = 0
  const tokensWithLogo: TokenInfo[] = []
  for (const token of fetchedTokens) {
    console.info(`${++i} of ${fetchedTokens.length}`)
    const cachedMultihash = await tryGet(
      cacheName(token.logoURI as string, token.symbol),
      db,
    )
    // Cache the ipfs hash of the shrunken image to save time.
    // If it was successfully pinned in both IPFS services, it won't be repeated.
    if (cachedMultihash) {
      tokensWithLogo.push({
        ...token,
        logoURI: `ipfs://${cachedMultihash}`,
      })
      console.info(` got cache: ipfs://${cachedMultihash}`)
      continue
    } else {
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
          console.warn(
            ` Failed to upload ${token.symbol} to gateway IPFS.`,
            err,
          )
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
              `images/${cacheName(token.logoURI as string, token.symbol)}.png`,
            )
            const readableStream = fs.createReadStream(
              `images/${cacheName(token.logoURI as string, token.symbol)}.png`,
            )
            pinataHash = (await pinata.pinFileToIPFS(readableStream)).IpfsHash
            console.info(` Done.`)
            break
          } catch (err) {
            console.warn(` Failed to upload ${token.symbol} to pinata.`, err)
            if (attempt === 5)
              console.error(
                ` Could not upload ${token.symbol} image to pinata after 5 attempts.`,
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
      const multihash = ipfsResponse ? ipfsResponse[0].hash : pinataHash

      if (ipfsResponse && pinataHash) {
        // Was successfully pinned to two places, no point in resubmitting.
        console.log(` Caching ${multihash}`)
        await db.put(
          cacheName(token.logoURI as string, token.symbol),
          multihash,
        )
      }

      tokensWithLogo.push({
        ...token,
        logoURI: `ipfs://${multihash}`,
      })
    }
  }

  // Publish fungible tokens
  await checkPublishErc20(
    tokensWithLogo,
    pinata,
    provider,
    process.env.LATEST_TOKEN_LIST_URL,
    process.env.ENS_TOKEN_LIST_NAME,
    'Tokens',
    't2cr.tokenlist.json',
  )
}

main()
