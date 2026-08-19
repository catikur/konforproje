import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
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
}
