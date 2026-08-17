import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(data: {
    username: string;
    password: string;
    displayName: string;
    role: Role;
    actorId: string;
  }) {
    const exists = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (exists) throw new ConflictException("Kullanıcı adı kullanımda");
    const passwordHash = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        displayName: data.displayName,
        role: data.role,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: "USER_CREATE",
        entityType: "User",
        entityId: user.id,
        meta: { username: user.username, role: user.role },
      },
    });
    return user;
  }

  async update(
    id: string,
    data: {
      displayName?: string;
      role?: Role;
      isActive?: boolean;
      password?: string;
      actorId: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    const passwordHash = data.password
      ? await argon2.hash(data.password)
      : undefined;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: data.displayName,
        role: data.role,
        isActive: data.isActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: id,
        meta: {
          displayName: data.displayName,
          role: data.role,
          isActive: data.isActive,
          passwordChanged: Boolean(data.password),
        },
      },
    });
    return updated;
  }
}
