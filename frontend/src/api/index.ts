import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error(`API Error: ${err.config?.url}`, err.message)
    return Promise.reject(err)
  }
)

export default api
