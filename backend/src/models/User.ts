export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  password_hash?: string;
}