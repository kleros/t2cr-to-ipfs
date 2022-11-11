import dotenv from 'dotenv-safe'
dotenv.config({ path: '.env', allowEmptyValues: true })

import { ethers } from 'ethers'
import { TokenInfo } from '@uniswap/token-lists'
import axios from 'axios'

import { CollectibleInfo } from '@0xsequence/collectible-lists'
import { GeneralizedTCR } from '@kleros/gtcr-sdk'

import { ERC20ABI } from './abis'
import { ERC721ABI } from './abis'
import { getTokens, getAddressesWithBadge } from './utils'
import estuaryRequest from './api/estuary-api'
import checkPublishErc20 from './erc20'
import checkPublishNFT from './nft'

console.info('Starting...')

async function main() {
  console.info()
  console.info('Running...')
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  )
  provider.pollingInterval =
    Number(process.env.POLL_PERIOD_SECONDS) || 60 * 1000 // Poll every minute.

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

    const { data: imageBuffer } = await axios.get(
      `${process.env.IPFS_GATEWAY}${token.logoURI}`,
      {
        responseType: 'arraybuffer',
      },
    )
    console.info(` Pinning shrunk image to ${process.env.ESTUARY_GATEWAY}`)
    const uploadedPin = await estuaryRequest.uploadFile(
      `${token.symbol}.png`,
      imageBuffer,
      { retryCount: 5 },
    )
    console.info(` Done.`)

    tokensWithLogo.push({
      ...token,
      logoURI: uploadedPin?.retrieval_url,
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

  const nftTokens: CollectibleInfo[] = []
  for (const checkToken of potentiallyMissingDecimals) {
    try {
      const token = new ethers.Contract(checkToken.address, ERC20ABI, provider)
      latestTokens.push({
        ...checkToken,
        decimals: Number(await token.decimals()),
      })
    } catch (err) {
      if (err instanceof Error) {
        console.warn(
          `${checkToken.symbol}/${checkToken.name} @ ${checkToken.address}, chainId ${chainId} throws when 'decimals' is called with error ${err.message}.`,
        )
      } else {
        console.warn('Unexpected error', err)
      }
      console.warn(` Checking if it is an NFT`)
      const nftToken = new ethers.Contract(
        checkToken.address,
        ERC721ABI,
        provider,
      )
      let is721 = false
      let is1155 = false
      try {
        const ERC721InterfaceSignature = '0x9a20483d'
        const ERC1155InterfaceSignature = '0xd9b67a26'
        const res = await Promise.all([
          nftToken.supportsInterface(ERC721InterfaceSignature),
          nftToken.supportsInterface(ERC1155InterfaceSignature),
        ])

        is721 = res[0]
        is1155 = res[1]
      } catch (error) {
        // No-op, handled in finally.
      } finally {
        if (is721) {
          console.info(` This is an ERC721 token, adding it to the list.`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nft = { ...checkToken, standard: 'erc721' } as any
          delete nft.decimals
          nftTokens.push(nft)
          continue
        } else if (is1155) {
          console.info(` This is an ERC1155 token, adding it to the list.`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nft = { ...checkToken, standard: 'erc1155' } as any
          delete nft.decimals
          nftTokens.push(nft)
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
          decimals: Number(entry.decodedData[1]),
        })
        console.info(' |')
        console.info(
          `  --Got decimal places from list: ${Number(entry.decodedData[1])}`,
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
        latestTokens.concat(latestTokens).forEach((token) => {
          if (token.address === address && !token.tags?.includes(name))
            token.tags?.push(name)
        })
        nftTokens.concat(nftTokens).forEach((token) => {
          if (token.address === address && !token.tags?.includes(name))
            token.tags?.push(name)
        })
      })
    })
  })

  Object.keys(tags).map((tag) => {
    console.info(
      `Tokens with the ${tag} badge: ${
        latestTokens
          .concat(latestTokens)
          .filter((token) => token.tags && token.tags.includes(tag)).length
      }`,
    )
  })

  // Publish fungible tokens
  await checkPublishErc20(
    latestTokens,
    provider,
    process.env.LATEST_TOKEN_LIST_URL,
    process.env.ENS_TOKEN_LIST_NAME,
    'Tokens',
    't2cr.tokenlist.json',
  )

  // Publish NFTs
  await checkPublishNFT(
    nftTokens,
    provider,
    process.env.LATEST_NFT_LIST_URL,
    process.env.ENS_NFT_LIST_NAME,
    'NFTs',
    't2crnfts.tokenlist.json',
  )
}

main()
