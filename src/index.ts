import dotenv from 'dotenv-safe'
import { ethers } from 'ethers'
import { TokenInfo } from '@uniswap/token-lists'
import fetch from 'node-fetch'
import sharp from 'sharp'
import fs from 'fs'
import { Level } from 'level'

dotenv.config({ path: '.env', allowEmptyValues: true })

import { ipfsPublish, getTokens } from './utils'
import checkPublishErc20 from './erc20'

if (!fs.existsSync('images')) fs.mkdirSync('images')
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

interface IPFSResponse {
  hash: string
}

async function main() {
  const db = new Level('./db')
  console.info()
  console.info('Running...')
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )

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
      const imageUrl = `${process.env.IPFS_GATEWAY}${token.logoURI}`
      console.info(`Fetching image from URL: ${imageUrl}`)
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          const imageBuffer = await (await fetch(imageUrl)).buffer()
          const imageSharp = sharp(imageBuffer)
          const metadata = await imageSharp.metadata()
  
          console.debug(`Image metadata:`, metadata)
  
          if (!metadata.format) {
            throw new Error('Unsupported image format')
          }
  
          const resizedImageBuffer = await imageSharp.resize(64, 64).png().toBuffer()
  
          console.info(` Pinning shrunk image to ${process.env.IPFS_GATEWAY}`)
          let ipfsResponse: IPFSResponse[] | null = null
  
          for (let attemptIPFS = 1; attemptIPFS <= 5; attemptIPFS++) {
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
              if (attemptIPFS === 5) {
                console.error(
                  ` Could not upload ${token.symbol} image to gateway IPFS after 5 attempts.`,
                )
              } else {
                console.warn(` Retrying ${attemptIPFS + 1} of ${5}`)
              }
            }
          }
  
          if (!ipfsResponse) {
            console.error()
            throw new Error(
              `Failed to upload ${token.symbol} image to ipfs gateway. Halting`,
            )
          }
  
          const multihash = ipfsResponse[0].hash 
  
          if (ipfsResponse) {
            // Was successfully pinned to IPFS, no point in resubmitting.
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
          break
        } catch (err) {
          console.error(`Failed to process image for token ${token.symbol}:`, err)
          console.error(`Token details:`, token)
          console.warn(` Retrying ${attempt + 1} of ${10}`)
          if (attempt == 10) {
            throw (err)
          }
        }
      }
      
    }
  }

  // Publish fungible tokens
  await checkPublishErc20(
    tokensWithLogo,
    provider,
    process.env.LATEST_TOKEN_LIST_URL,
    process.env.ENS_TOKEN_LIST_NAME,
    'Tokens',
    't2cr.tokenlist.json',
  )
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)  // Added to ensure the script exits with an error code
})
