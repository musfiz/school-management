import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList, Wire } from '../prisma/wire';
import type { Users } from '../generated/prisma/client';
import { CreateUserDto, UpdateUserDto } from './user.dto';

/** The snake_case row the users API returns (see `prisma/wire.ts`). */
export type UserRecord = Wire<Users>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserRecord> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // The password is hashed by the central Prisma extension
    // (src/prisma/password-hashing.extension.ts), not here.
    const user = await this.prisma.users.create({ data: { ...createUserDto } });
    return toWire(user);
  }

  async findAll() {
    const rows = await this.prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });
    return toWireList(rows);
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return toWire(user);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.users.findUnique({ where: { email } });
    return user ? toWire(user) : null;
  }

  async findByIdWithPassword(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.users.findUnique({ where: { id } });
    return user ? toWire(user) : null;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Preserve the old find-then-save flow: 404 before touching the row.
    await this.findOne(id);

    // `findOne` originally selected a subset that excluded `password`; keep the
    // update response identical (no password, and `updated_at` included).
    const user = await this.prisma.users.update({
      where: { id },
      data: { ...updateUserDto },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return toWire(user);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.users.delete({ where: { id } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
