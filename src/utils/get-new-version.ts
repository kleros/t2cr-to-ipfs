import { TokenInfo, Version, TokenList } from '@uniswap/token-lists'

/**
 * Calculates a new version object from two T2CR token lists.
 * Important: This function assumes the input lists do not include tokens with duplicate addresses or different chainIds (which is the case when pulling from the t2cr with the view contract).
 * @param oldList The previous list to compare the new with.
 * @param newList The new list.
 */
export default function (oldList: TokenList, newList: TokenInfo[]): Version {
  //   List versions must follow the rules:
  //     Increment major version when tokens are removed
  //     Increment minor version when tokens are added
  //     Increment patch version when tokens already on the list have minor details changed (name, symbol, logo URL)
  //  Changing a token address or chain ID is considered both a remove and an add, and should be a major version update.
  // TODO: Convert both lists to a map<address, tokenInfo>. Iterate over the new list and compare to the previous list. Calculate the version accordingly.

  return oldList.version
}
