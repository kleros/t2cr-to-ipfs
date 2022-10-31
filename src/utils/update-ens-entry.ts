import { ethers } from 'ethers'
import { encode } from 'content-hash'
import namehash from 'eth-ens-namehash'
import { getContractInstance } from './get-contract-instance'

// As of v5.0.5, Ethers ENS API doesn't include managing ENS names, so we
// can't use it directly. Neither does the ethjs API.
// Web3js supports it via web3.eth.ens but it can't sign transactions
// locally and send them via eth_sendRawTransaction, which means it can't
// be used with Ethereum endpoints that don't support
// eth_sendTransaction (e.g. Infura).
//
// We'll have to interact with the contracts directly.
export const updateEnsEntry = async (
  ensListName: string,
  contentHash: string,
  abi: ethers.ContractInterface,
  provider: ethers.providers.JsonRpcProvider,
) => {
  const ensName = namehash.normalize(ensListName)
  const ensNamehash = namehash.hash(ensName)

  const [signer, resolver] = await getContractInstance(ensName, abi, provider)
  const encodedContentHash = `0x${encode('ipfs-ns', contentHash)}`
  console.info()
  console.info('Updating ens entry...')
  console.info(`Manager: ${await signer.getAddress()}`)
  await resolver.setContenthash(ensNamehash, encodedContentHash)
  console.info(
    `Done. List available at ${process.env.IPFS_GATEWAY}/ipfs/${contentHash}`,
  )
}
