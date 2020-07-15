import fetch from 'node-fetch'

export default async function pinataPin(hash: string): Promise<any> {
  return fetch(`${process.env.PINATA_URL}/pinning/pinByHash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: process.env.PINATA_API_KEY || '',
      pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY || '',
    },
    body: JSON.stringify({
      hashToPin: hash,
    }),
  })
}
