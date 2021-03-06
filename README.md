<p align="center">
  <b style="font-size: 32px;">T2CR to IPFS</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
</p>

Pulls token information from the kleros T2CR and publishes to IPFS following uniswap/token-lists schema.

## Requirements

Tested on node version 10.21.0.

## Debugging

If developing in VS Code/Codium, you can use this `.vscode/launch.json` file for debugging:

```
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to dev:debug",
      "protocol": "inspector",
      "port": 4321,
      "restart": true,
      "cwd": "${workspaceRoot}"
    }
  ]
}
```

## Contributing

See CONTRIBUTING.md.