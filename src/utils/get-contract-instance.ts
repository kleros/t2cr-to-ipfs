import { ethers } from 'ethers'

export const getContractInstance = async (
  ensName: string,
  abi: ethers.ContractInterface,
  provider: ethers.providers.JsonRpcProvider,
): Promise<[ethers.Wallet, ethers.Contract]> => {
  const signer = new ethers.Wallet(process.env.WALLET_KEY || '', provider)
  const resolver = new ethers.Contract(
    await provider._getResolver(ensName),
    abi,
    signer,
  )
  return [signer, resolver]
}
