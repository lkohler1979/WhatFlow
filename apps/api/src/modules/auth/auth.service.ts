import { supabaseAdmin, supabaseAuth } from '@core/supabase.js';
import { logger } from '@core/logger.js';
import { config } from '@core/config.js';
import { ConflictError, UnauthorizedError, AppError } from '@core/errors.js';
import { authRepository } from './auth.repository.js';
import type { ForgotPasswordDto, LoginDto, RegisterDto, RefreshDto } from './auth.schema.js';

interface SessionDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tenantId: string;
  };
  session: SessionDto;
}

/** Gera um slug único a partir do nome da empresa. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function generateUniqueSlug(companyName: string): Promise<string> {
  const base = slugify(companyName) || 'tenant';
  let slug = base;
  let attempt = 0;
  while (await authRepository.slugExists(slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
    if (attempt > 50) {
      slug = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
}

function getPasswordResetRedirectUrl(): string {
  const frontendOrigin =
    config.CORS_ORIGINS.split(',')
      .map(origin => origin.trim())
      .find(Boolean) ?? 'http://localhost:4200';

  return `${frontendOrigin.replace(/\/+$/, '')}/auth/reset-password`;
}

export const authService = {
  /** Registra empresa + usuário OWNER e devolve tokens. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    // 1) Cria usuário no Supabase Auth
    const created = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      const msg = created.error?.message ?? 'Falha ao criar usuário';
      if (/already|registered|exists/i.test(msg)) {
        throw new ConflictError('E-mail já cadastrado');
      }
      throw new AppError(msg, 502, 'SUPABASE_ERROR');
    }

    const supabaseUid = created.data.user.id;

    // 2) Cria tenant + usuário no banco (com rollback do Supabase em falha)
    let tenantId: string;
    try {
      const slug = await generateUniqueSlug(dto.companyName);
      const { tenant } = await authRepository.createTenantWithOwner({
        companyName: dto.companyName,
        slug,
        supabaseUid,
        email: dto.email,
        fullName: dto.fullName,
      });
      tenantId = tenant.id;
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid).catch(() => undefined);
      logger.error({ err }, 'Falha ao persistir tenant/usuário no registro');
      throw err;
    }

    // 3) Injeta tenant_id e role no JWT via app_metadata
    const updated = await supabaseAdmin.auth.admin.updateUserById(supabaseUid, {
      app_metadata: { tenant_id: tenantId, role: 'OWNER' },
    });
    if (updated.error) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid).catch(() => undefined);
      await authRepository.deleteTenant(tenantId).catch(() => undefined);
      throw new AppError('Falha ao configurar metadados do usuário', 502, 'SUPABASE_ERROR');
    }

    // 4) Gera sessão (tokens) já com o app_metadata embutido
    const session = await this.signIn(dto.email, dto.password);

    return {
      user: {
        id: supabaseUid,
        email: dto.email,
        fullName: dto.fullName,
        role: 'OWNER',
        tenantId,
      },
      session,
    };
  },

  /** Login por e-mail/senha. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const session = await this.signIn(dto.email, dto.password);

    const profile = await authRepository.findUserBySupabaseUid(session.supabaseUid);
    if (!profile) throw new UnauthorizedError('Usuário não encontrado');

    await authRepository.touchLastLogin(session.supabaseUid);

    return {
      user: {
        id: profile.supabaseUid,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        tenantId: profile.tenantId,
      },
      session: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    };
  },

  /** Renova a sessão a partir do refresh token. */
  async refresh(dto: RefreshDto): Promise<SessionDto> {
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });
    if (error || !data.session) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    };
  },

  /** Dispara o e-mail de recuperação de senha pelo Supabase Auth. */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(dto.email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    if (error) {
      logger.warn({ err: error }, 'Falha ao solicitar recuperação de senha no Supabase');
      throw new AppError('Não foi possível enviar o e-mail de recuperação', 502, 'SUPABASE_ERROR');
    }
  },

  /** Logout — invalida a sessão no Supabase quando possível. */
  async logout(accessToken?: string): Promise<void> {
    if (!accessToken) return;
    await supabaseAdmin.auth.admin
      .signOut(accessToken)
      .catch(err => logger.warn({ err }, 'Falha ao invalidar sessão no logout'));
  },

  /** Helper interno: autentica e devolve tokens + uid. */
  async signIn(email: string, password: string) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedError('Credenciais inválidas');
    }
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      supabaseUid: data.user.id,
    };
  },
};
