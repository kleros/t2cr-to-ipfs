import getNewVersion from '../src/utils/get-new-version'
import TestTokenList from '../src/utils/test-token-list.json'
import { cloneDeep } from 'lodash'

test('Increments minor version if a token is added', () => {
  const newList = [
    ...TestTokenList.tokens,
    {
      chainId: 1,
      address: '0xB0b86791c6218b36c1d19D4a2e9Eb0cE3606eA37',
      symbol: 'TST',
      name: 'TestCoin',
      decimals: 18,
      logoURI: 'ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM',
      tags: ['stablecoin'],
    },
  ]

  expect(getNewVersion(TestTokenList, newList)).toEqual({
    major: 1,
    minor: 1,
    patch: 0,
  })
})

test('Increments the major version when tokens are removed', () => {
  const newList = TestTokenList.tokens.slice(1)

  // Should increment minor version when tokens are added
  expect(getNewVersion(TestTokenList, newList)).toEqual({
    major: 2,
    minor: 0,
    patch: 0,
  })
})

test('Increments the patch version when tokens already on the list have minor details changed (name, symbol, logo URL)', () => {
  const newList = cloneDeep(TestTokenList.tokens)
  newList[0].symbol = `a${newList[0].name}`
  newList[1].name = `${newList[1].name} Token`

  // Should increment minor version when tokens are added
  expect(getNewVersion(TestTokenList, newList)).toEqual({
    major: 1,
    minor: 0,
    patch: 1,
  })
})

test('Changing a token address or chain ID is considered both a remove and an add, and should be a major version update', () => {
  const newList = cloneDeep(TestTokenList.tokens)
  newList[0].chainId = 42
  newList[1].address = '0xB0b86791c6218b36c1d19D4a2e9Eb0cE3606eA37'

  // Should increment minor version when tokens are added
  expect(getNewVersion(TestTokenList, newList)).toEqual({
    major: 1,
    minor: 0,
    patch: 1,
  })
})
