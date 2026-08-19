import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { writeAudit } from "../common/audit";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_DAYS = 30;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Kullanıcı adı veya şifre hatalı");
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException("Kullanıcı adı veya şifre hatalı");
    }
    return this.issueTokens(user.id, user.username, user.role, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      !stored.user.isActive ||
      stored.user.deletedAt
    ) {
      throw new UnauthorizedException("Oturum geçersiz");
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user.id, stored.user.username, stored.user.role, {
      id: stored.user.id,
      username: stored.user.username,
      displayName: stored.user.displayName,
      role: stored.user.role,
    });
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { ok: true };
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException("Mevcut şifre hatalı");
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(this.prisma, {
      actorId: userId,
      action: "PASSWORD_CHANGE",
      entityType: "User",
      entityId: userId,
    });
    return { ok: true };
  }

  private async issueTokens(
    userId: string,
    username: string,
    role: string,
    user: { id: string; username: string; displayName: string; role: string },
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, role },
      {
        secret: this.jwtSecret(),
        expiresIn: ACCESS_TTL_SEC,
      },
    );
    const refreshToken = randomBytes(48).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, user };
  }

  jwtSecret() {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret || secret === "dev-secret") {
      if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET tanımlı olmalı");
      }
    }
    if (!secret) {
      throw new Error("JWT_SECRET tanımlı olmalı (.env)");
    }
    return secret;
  }
}
