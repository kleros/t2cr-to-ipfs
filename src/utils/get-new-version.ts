import { TokenInfo, Version, TokenList } from '@uniswap/token-lists'
import { difference, isEqual } from 'lodash'

/**
 * Calculates a new version object from two T2CR token lists.
 * Important: This function assumes the input lists do not include tokens with duplicate addresses or different chainIds (which is the case when pulling from the t2cr with the view contract). It also assumes the token addresses are checksummed.
 * @param oldList The previous list to compare the new with.
 * @param newList The new list.
 */
export default function (oldList: TokenList, newList: TokenInfo[]): Version {
  // List versions must follow the rules:
  //   1- Increment major version when tokens are removed
  //   2- Increment minor version when tokens are added
  //   3- Increment patch version when tokens already on the list have minor details changed (name, symbol, logo URL)
  //   4- Changing a token address or chain ID is considered both a remove and an add, and should be a major version update.
  // Note that for the case of the T2CR using a view contract, number 4 will never happen.

  const oldTokensMapping: { [key: string]: unknown } = {}
  oldList.tokens.forEach((token) => {
    oldTokensMapping[token.address] = token
  })

  let incrementMajor = false
  let incrementMinor = false
  let incrementPatch = false
  for (const token of newList) {
    if (!oldTokensMapping[token.address]) {
      incrementMinor = true // Token added.
      continue
    }

    if (isEqual(token, oldTokensMapping[token.address])) {
      continue
    } else {
      incrementPatch = true // Token details changed.
    }
  }

  // Detect if tokens were removed.
  if (
    difference(
      Object.keys(oldTokensMapping),
      newList.map((t) => t.address),
    ).length > 0
  ) {
    incrementMajor = true
  }

  if (incrementMajor)
    return {
      major: oldList.version.major + 1,
      minor: 0,
      patch: 0,
    }

  if (incrementMinor)
    return {
      major: oldList.version.major,
      minor: oldList.version.minor + 1,
      patch: 0,
    }

  if (incrementPatch)
    return {
      ...oldList.version,
      patch: oldList.version.patch + 1,
    }

  return oldList.version
}
