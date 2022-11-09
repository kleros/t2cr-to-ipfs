import { AxiosError, AxiosRequestConfig } from 'axios'

export interface AxiosConfigCustom extends AxiosRequestConfig {
  retryCount?: number
  retryDelay?: number
}

export interface AxiosErrorCustom extends AxiosError {
  config: AxiosConfigCustom
}
export interface EstuaryUploadResponse {
  cid: string
  estuaryId: number
  retrieval_url: string
  provideres: string[]
}
