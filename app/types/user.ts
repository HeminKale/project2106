export interface UserFormData {
  email: string;
  password?: string; // Password is optional for editing
  full_name: string;
  role: string;
  department?: string;
} 