import axios, { AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import dotenv from 'dotenv'
dotenv.config()

interface IResponseData {
  cid: string
  estuaryId: number
  retrieval_url: string
  provideres: string[]
}

const axiosInstance = axios.create({
  baseURL: `${process.env.ESTUARY_BASE_URL}`,
})

axiosInstance.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${process.env.ESTUARY_API_KEY}`
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

const uploadFile = async (
  fileName: string,
  data: ArrayBuffer,
): Promise<IResponseData> => {
  const formData = new FormData()
  formData.append('data', data, fileName)
  let response: any
  try {
    response = await axiosInstance.post(`content/add`, formData, {
      headers: formData.getHeaders(),
    })
  } catch (error) {
    console.log(error)
  }
  return response.data
}

export default { uploadFile }
