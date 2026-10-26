export interface RoleProps {
  id: string;
  name: string;
  permissions: string[];
}

export class Role {
  private constructor(private readonly props: RoleProps) {}

  static reconstitute(props: RoleProps): Role {
    return new Role(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get permissions(): string[] {
    return this.props.permissions;
  }

  static toClaims(roles: Role[]): { roleNames: string[]; permissions: string[] } {
    return {
      roleNames: roles.map((role) => role.name),
      permissions: [...new Set(roles.flatMap((role) => role.permissions))],
    };
  }
}
