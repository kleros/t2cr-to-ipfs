import { File, FilebaseClient } from '@filebase/client';

const filebase = new FilebaseClient({ 
  token: process.env.FILEBASE_TOKEN ?? ""
});

/**
 * Send file to IPFS network via Filebase
 * @param {string} fileName - The name that will be used to store the file. This is useful to preserve extension type.
 * @param {ArrayBuffer} data - The raw data from the file to upload.
 * @returns {object} ipfs response. Should include the hash and path of the stored item.
 */
async function ipfsPublish(
  fileName: string,
  data: ArrayBuffer | Buffer,
): Promise<{ hash: string; path: string }[]> {  // Return an array of objects with a hash property
  const buffer = Buffer.from(data);

  const cid = await filebase.storeDirectory([new File([buffer], fileName)]);
  
  return [{ hash: cid, path: `${cid}/${fileName}` }];  // Return an array
}

export default ipfsPublish
