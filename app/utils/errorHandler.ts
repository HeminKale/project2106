// Error handling utility for consistent error messages across the app

export interface ErrorDetails {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  [key: string]: any;
}

export const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.details) {
    return error.details;
  }
  
  if (error?.hint) {
    return error.hint;
  }
  
  return 'An unexpected error occurred';
};

export const logError = (context: string, error: any, additionalData?: any) => {
  console.error(`❌ Error in ${context}:`, error);
  if (additionalData) {
    console.error(`❌ Additional data:`, additionalData);
  }
};

export const createErrorState = () => {
  return {
    error: null as string | null,
    setError: (message: string | null) => {},
    clearError: () => {}
  };
}; 