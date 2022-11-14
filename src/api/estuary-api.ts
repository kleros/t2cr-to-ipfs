import dotenv from 'dotenv'
dotenv.config()
import axios, { AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import {
  AxiosConfigCustom,
  AxiosErrorCustom,
  EstuaryUploadResponse,
} from './interfaces'

const upload = axios.create({
  baseURL: `${process.env.ESTUARY_BASE_URL}`,
})

upload.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${process.env.ESTUARY_API_KEY}`
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

upload.interceptors.response.use(undefined, async (error: AxiosErrorCustom) => {
  const { config, message } = error

  if (!config || !config.retryCount) {
    return Promise.reject(error).then(() =>
      console.error('Maximum retry count for request has been reached'),
    )
  }

  if (!(message.includes('timeout') || message.includes('Network error'))) {
    return Promise.reject(error)
  }

  config.retryCount -= 1
  const delayRetryRequest = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('Api call failed. Retrying the request to', config.url)
      console.log(`${config.retryCount} retry count left`)
      resolve()
    }, config.retryDelay || 1000)
  })
  await delayRetryRequest
  return await upload(config)
})

const uploadFile = async (
  fileName: string,
  data: ArrayBuffer,
  config?: AxiosConfigCustom,
): Promise<EstuaryUploadResponse> => {
  const formData = new FormData()
  formData.append('data', data, fileName)
  let response: any
  try {
    response = await upload.post(`content/add`, formData, <AxiosConfigCustom>{
      headers: formData.getHeaders(),
      ...config,
    })
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.log(error.response.data)
    } else {
      console.log('Unexpected Error', error)
    }
  }
  return response.data
}

export default { uploadFile }
