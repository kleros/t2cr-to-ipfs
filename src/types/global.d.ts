import { BigNumber } from 'ethers'

interface Token {
  ID: string
  name: string
  ticker: string
  addr: string
  symbolMultihash: string
  status: number
  decimals: BigNumber
}

interface FormattedToken {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
  tags: string[]
}
