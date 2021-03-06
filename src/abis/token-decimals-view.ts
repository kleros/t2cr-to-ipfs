export default [
  {
    inputs: [{ internalType: 'address[]', name: '_tokens', type: 'address[]' }],
    name: 'getTokenDecimals',
    outputs: [
      { internalType: 'uint256[]', name: 'decimals', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
