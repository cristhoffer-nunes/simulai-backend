import { AppConfigService } from '@/config/app-config.service';
import {
  escapeHtml,
  render,
  ResendEmailAdapter,
} from '@/modules/identity/infrastructure/adapters/resend-email.adapter';

describe('ResendEmailAdapter', () => {
  const config = (key = 're_test') =>
    ({
      email: { resendApiKey: key, fromAddress: 'Simulai <no-reply@x.test>' },
    }) as unknown as AppConfigService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function sentBody() {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      from: string;
      to: string;
      subject: string;
      html: string;
    };
  }

  it('sends the invite with escaped values', async () => {
    await new ResendEmailAdapter(config()).sendInviteEmail({
      to: 'a@b.co',
      userName: '<script>Ana</script>',
      accessUrl: 'https://app/redefinir-senha?token=t&x=1',
      validFor: '3 dias',
    });

    const body = sentBody();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer re_test');
    expect(body.subject).toBe('Seu acesso ao Simulai — crie sua senha');
    expect(body.html).toContain('&lt;script&gt;Ana&lt;/script&gt;');
    expect(body.html).toContain('token=t&amp;x=1');
    expect(body.html).toContain('3 dias');
    expect(body.html).not.toMatch(/\{\{\w+\}\}/);
  });

  it('sends reset and password-changed emails', async () => {
    const adapter = new ResendEmailAdapter(config());
    await adapter.sendPasswordResetEmail({
      to: 'a@b.co',
      resetUrl: 'https://r',
      validFor: '1 hora',
    });
    await adapter.sendPasswordChangedEmail({
      to: 'a@b.co',
      changedAt: new Date('2026-10-26T15:00:00Z'),
    });

    const changed = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { html: string };
    expect(changed.html).toContain('26/10/2026');
    expect(changed.html).toContain('horário de Brasília');
  });

  it('fails loudly when the provider rejects or is not configured', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'bad' });
    await expect(
      new ResendEmailAdapter(config()).sendPasswordResetEmail({
        to: 'a',
        resetUrl: 'r',
        validFor: 'v',
      }),
    ).rejects.toThrow('Resend API request failed (422): bad');

    await expect(
      new ResendEmailAdapter(config('')).sendPasswordResetEmail({
        to: 'a',
        resetUrl: 'r',
        validFor: 'v',
      }),
    ).rejects.toThrow('RESEND_API_KEY is not configured.');
  });

  it('tolerates an unreadable error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => Promise.reject(new Error('x')),
    });
    await expect(
      new ResendEmailAdapter(config()).sendPasswordResetEmail({
        to: 'a',
        resetUrl: 'r',
        validFor: 'v',
      }),
    ).rejects.toThrow('Resend API request failed (500): ');
  });

  it('render/escapeHtml replace every placeholder occurrence', () => {
    expect(render('{{a}} {{a}}', { a: '"x"' })).toBe('&quot;x&quot; &quot;x&quot;');
    expect(escapeHtml("'&")).toBe('&#39;&amp;');
  });
});
