export interface InviteEmailInput {
  to: string;
  userName: string;
  accessUrl: string;
  /** How long the link is valid, already formatted for the reader (e.g. "3 dias"). */
  validFor: string;
}

export interface PasswordResetEmailInput {
  to: string;
  resetUrl: string;
  validFor: string;
}

export interface PasswordChangedEmailInput {
  to: string;
  changedAt: Date;
}

// Port — expresses which transactional email, with what business data. The adapter owns
// rendering and delivery (ResendEmailAdapter).
export interface IEmailPort {
  sendInviteEmail(input: InviteEmailInput): Promise<void>;
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;
  sendPasswordChangedEmail(input: PasswordChangedEmailInput): Promise<void>;
}

export const EMAIL_PORT = Symbol('EMAIL_PORT');
