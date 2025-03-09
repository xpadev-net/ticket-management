/**
 * Authentication and fetch utilities for API calls
 */
import { ApiResponse } from './schema';

/**
 * Wrapper for fetch that automatically adds authentication headers
 */
export const fetchWithAuth = async <T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json() as ApiResponse<T>;

  // If the response is not ok or api response indicates an error, throw an error
  if (!response.ok || !data.success) {
    throw new Error(data.success === false ? data.error : `API error: ${response.status}`);
  }

  return data.data;
};

/**
 * SWR fetcher function using our authenticated fetch
 */
export const swrFetcher = <T>(url: string): Promise<T> => fetchWithAuth<T>(url);

/**
 * PUT request with authentication
 */
export const putWithAuth = async <T, D = any>(url: string, data: D): Promise<T> => {
  return fetchWithAuth<T>(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * POST request with authentication
 */
export const postWithAuth = async <T, D = any>(url: string, data: D): Promise<T> => {
  return fetchWithAuth<T>(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
};