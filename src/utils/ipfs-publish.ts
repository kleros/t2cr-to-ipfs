import fetch from 'node-fetch'

/**
 * Send file to IPFS network via the Kleros IPFS node
 * @param {string} fileName - The name that will be used to store the file. This is useful to preserve extension type.
 * @param {ArrayBuffer} data - The raw data from the file to upload.
 * @returns {object} ipfs response. Should include the hash and path of the stored item.
 */
async function ipfsPublish(fileName: string, data: ArrayBuffer): Promise<any> {
  const buffer = await Buffer.from(data)

  return (
    await (
      await fetch(`${process.env.IPFS_GATEWAY}/add`, {
        method: 'POST',
        body: JSON.stringify({
          fileName,
          buffer,
        }),
        headers: {
          'content-type': 'application/json',
        },
      })
    ).json()
  ).data
}

export default ipfsPublish
