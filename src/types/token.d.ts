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
