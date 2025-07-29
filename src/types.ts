export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export type Status = 'pending' | 'success' | 'error' | 'loading';

export interface Config {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export type EventHandler<T = any> = (event: T) => void;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
} 