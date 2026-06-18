import axios from 'axios';

declare module 'axios' {
  export interface AxiosResponse<T = any>  {
    pagination?: {
      count: number;
      next: string | null;
      previous: string | null;
    };
  }
}

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to unwrap Django pagination transparently
api.interceptors.response.use(
  (response) => {
    // If the response matches DRF pagination signature
    if (response.data && typeof response.data === 'object' && 'results' in response.data && 'count' in response.data) {
      response.pagination = {
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous
      };
      // Unwrap the results array so .map() logic doesn't crash on standard components
      response.data = response.data.results;
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
