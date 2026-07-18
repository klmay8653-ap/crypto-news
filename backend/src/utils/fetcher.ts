import axios, { AxiosRequestConfig } from 'axios';
import { logger } from './logger';

export async function fetchWithRetry<T = unknown>(
  url: string,
  options: AxiosRequestConfig = {},
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get<T>(url, {
        timeout: 15000,
        ...options,
      });
      return response.data;
    } catch (error: any) {
      logger.warn(`Fetch attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}
