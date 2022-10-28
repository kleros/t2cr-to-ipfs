import Ajv, { JSONSchemaType } from 'ajv'
import addFormats from 'ajv-formats'
import { CollectibleList } from '@0xsequence/collectible-lists/dist/types'
import { TokenList } from '@uniswap/token-lists/dist/types'

const ajv = new Ajv({
  allErrors: true,
  $data: true,
  verbose: true,
})
addFormats(ajv)

export const validateCollectibleList = (
  schema: JSONSchemaType<string>,
  dataList: CollectibleList | TokenList,
): void => {
  const validator = ajv.compile(schema)
  if (!validator(dataList)) {
    console.error('Validation errors encountered.')
    if (validator.errors)
      validator.errors.map((err: unknown) => {
        console.error(err)
      })
    throw new Error(`Could not validate generated list ${dataList}`)
  }
}
