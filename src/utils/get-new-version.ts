import { TokenInfo, Version, TokenList } from '@uniswap/token-lists'
import { difference, isEqual } from 'lodash'

/**
 * Calculates a new version object from two token lists.
 * Important: This function assumes the input lists do not include tokens with duplicate addresses or different chainIds (which is the case when pulling with the view contract). It also assumes the token addresses are checksummed.
 * @param previousTokens The previous list to compare the new with.
 * @param latestTokens The new list.
 * @param invalidTokens These are tokens that failed uniswap-tokenlists validation rules.
 */
export default function getNewVersion(
  previousTokens: TokenList,
  latestTokens: TokenInfo[],
  invalidTokens: TokenInfo[],
): Version {
  // List versions must follow the rules:
  //   1- Increment major version when tokens are removed
  //   2- Increment minor version when tokens are added
  //   3- Increment patch version when tokens already on the list have minor details changed (name, symbol, logo URL)
  //   4- Changing a token address or chain ID is considered both a remove and an add which produce a major version update.
  // Note that for the case of the using a view contract, number 4 will never happen.

  const oldTokensMapping: { [key: string]: unknown } = {}
  previousTokens.tokens.forEach((token) => {
    oldTokensMapping[token.address] = token
  })

  let incrementMajor = false
  let incrementMinor = false
  let incrementPatch = false
  for (const latestToken of latestTokens) {
    const previousToken = oldTokensMapping[latestToken.address]
    if (!previousToken && !invalidTokens.includes(latestToken)) {
      // Check if this token was not added because it failed uniswap
      // tokenlist rules.
      incrementMinor = true // Token added.
      continue
    }

    if (isEqual(latestToken, previousToken)) {
      continue
    } else {
      incrementPatch = true // Token details changed.
    }
  }

  // Detect if tokens were removed.
  if (
    difference(
      Object.keys(oldTokensMapping),
      latestTokens.map((t) => t.address),
    ).length > 0
  ) {
    const diff = difference(
      Object.keys(oldTokensMapping),
      latestTokens.map((t) => t.address),
    )
    console.info('diff:', diff)
    incrementMajor = true
  }

  if (incrementMajor)
    return {
      major: previousTokens.version.major + 1,
      minor: 0,
      patch: 0,
    }

  if (incrementMinor)
    return {
      major: previousTokens.version.major,
      minor: previousTokens.version.minor + 1,
      patch: 0,
    }

  if (incrementPatch)
    return {
      ...previousTokens.version,
      patch: previousTokens.version.patch + 1,
    }

  return previousTokens.version
}
