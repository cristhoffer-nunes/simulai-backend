import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfigService } from '../../../../config/app-config.service';
import {
  IEmailPort,
  InviteEmailInput,
  PasswordChangedEmailInput,
  PasswordResetEmailInput,
} from '../../application/ports/email.port';

const TEMPLATES_DIR = join(__dirname, '..', 'email-templates');

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatBrazilTime(date: Date): string {
  return `${DATE_FORMATTER.format(date)} (horário de Brasília)`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

// Every value is HTML-escaped: display names are typed by administrators.
export function render(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (html, [key, value]) => html.split(`{{${key}}}`).join(escapeHtml(value)),
    template,
  );
}

// Adapter — the three identity transactional emails through the Resend HTTP API. Templates are
// static HTML files loaded once at startup, rendered with plain {{token}} substitution.
@Injectable()
export class ResendEmailAdapter implements IEmailPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly inviteTemplate: string;
  private readonly passwordResetTemplate: string;
  private readonly passwordChangedTemplate: string;

  constructor(private readonly config: AppConfigService) {
    this.inviteTemplate = readFileSync(join(TEMPLATES_DIR, 'invite.html'), 'utf8');
    this.passwordResetTemplate = readFileSync(join(TEMPLATES_DIR, 'password-reset.html'), 'utf8');
    this.passwordChangedTemplate = readFileSync(
      join(TEMPLATES_DIR, 'password-changed.html'),
      'utf8',
    );
  }

  async sendInviteEmail(input: InviteEmailInput): Promise<void> {
    const html = render(this.inviteTemplate, {
      userName: input.userName,
      userEmail: input.to,
      accessUrl: input.accessUrl,
      validFor: input.validFor,
    });
    await this.deliver(input.to, 'Seu acesso ao Simulai — crie sua senha', html);
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    const html = render(this.passwordResetTemplate, {
      userEmail: input.to,
      resetUrl: input.resetUrl,
      validFor: input.validFor,
    });
    await this.deliver(input.to, 'Trocar a senha — Simulai', html);
  }

  async sendPasswordChangedEmail(input: PasswordChangedEmailInput): Promise<void> {
    const html = render(this.passwordChangedTemplate, {
      userEmail: input.to,
      changedAt: formatBrazilTime(input.changedAt),
    });
    await this.deliver(input.to, 'Sua senha foi alterada — Simulai', html);
  }

  private async deliver(to: string, subject: string, html: string): Promise<void> {
    if (!this.config.email.resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.config.email.fromAddress, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Resend API request failed (${response.status}): ${body}`);
    }

    this.logger.log(`Sent "${subject}".`);
  }
}
