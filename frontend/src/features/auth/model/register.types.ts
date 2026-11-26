export type RegisterValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountPurpose?: string;
};
export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;
export type RegisterHandler = (values: RegisterValues) => Promise<void>;
