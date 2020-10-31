import { BadgeABI } from '../abis'
import { ethers } from 'ethers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FILTER = [
  false, // Do not include absent items (e.g. items that were rejected or that were accepted but later removed).
  true, // Include registered items.
  false, // Do not include items with pending registration requests.
  true, // Include items with pending removal requests.
  false, // Do not include items with challenged registration requests.
  true, // Include items with challenged removal requests.
  false, // Include token if caller is the author of a pending request (not used).
  false, // Include token if caller is the challenger of a pending request (not used).
]

/**
 * Fetch token addresses for a badge.
 */
export default async function getAddressesWithBadge(
  badgeAddress: string,
  provider: ethers.providers.JsonRpcProvider,
): Promise<string[]> {
  const badge = new ethers.Contract(badgeAddress, BadgeABI, provider)

  const addressesWithBadge = new Set<string>()
  let hasMore = true
  let cursor = ZERO_ADDRESS
  console.info(`Fetching addresses with badge ${badgeAddress}`)
  while (hasMore) {
    const response = await badge.queryAddresses(
      cursor, // A token address to start/end the query from. Set to zero means unused.
      200, // Number of items to return at once.
      FILTER,
      true, // Return oldest first.
    )

    hasMore = response.hasMore

    // Since the contract returns fixed sized arrays, we must filter out unused items.
    const addresses = response[0].filter(
      (address: string) => address !== ZERO_ADDRESS,
    )

    addresses.forEach((address: string) => addressesWithBadge.add(address))
    cursor = addresses[addresses.length - 1]
  }
  return Array.from(addressesWithBadge)
}
