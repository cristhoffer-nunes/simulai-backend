import { randomUUID } from 'node:crypto';
import { DisplayName } from '../value-objects/display-name.vo';
import { Email } from '../value-objects/email.vo';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  displayName: DisplayName;
  isActive: boolean;
  // Accounts are created by an administrator: true until the holder sets their own password
  // through the first-access link. While true, login never opens a session.
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  /** New account created by an administrator, with an unusable provisional password hash. */
  static create(email: Email, displayName: DisplayName, provisionalPasswordHash: string): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      email,
      passwordHash: provisionalPasswordHash,
      displayName,
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get displayName(): DisplayName {
    return this.props.displayName;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(displayName: DisplayName): void {
    this.props.displayName = displayName;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  changePasswordHash(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
    this.touch();
  }

  clearMustChangePassword(): void {
    this.props.mustChangePassword = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
