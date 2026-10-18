import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { Language } from '../common/enums/language.enum.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  // Emails match whatever their case or stray spaces: a phone keyboard
  // often capitalises the first letter.
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  // The one place the password hash is read. Everything else gets a User
  // without it — see the column's `select: false`.
  findByEmailForLogin(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.email'])
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  /**
   * The congregant side of signing in: a phone number that verifies for the
   * first time becomes an account right there, with no separate sign-up
   * step. `firstName` is only written on that first sign-in — someone who
   * already has an account keeps the name they set, so re-verifying on a
   * new phone can't quietly rename them.
   */
  async findOrCreateByPhone(phone: string, firstName?: string): Promise<User> {
    const existing = await this.findByPhone(phone);
    if (existing) {
      return existing;
    }
    return this.usersRepository.save(
      this.usersRepository.create({ phone, firstName }),
    );
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  /**
   * The name someone sets for themselves in the app's settings. Only the
   * fields that were sent are written, so editing the first name never
   * wipes the last one.
   */
  async updateProfile(
    id: string,
    profile: { firstName?: string; lastName?: string },
  ): Promise<User> {
    const user = await this.findOne(id);
    if (profile.firstName !== undefined) {
      user.firstName = profile.firstName.trim();
    }
    if (profile.lastName !== undefined) {
      // An empty last name is a real answer, not a missing one: plenty of
      // people give only one name.
      user.lastName = profile.lastName.trim() || undefined;
    }
    return this.usersRepository.save(user);
  }

  async updateLastActivePoi(id: string, poiId: string): Promise<User> {
    const user = await this.findOne(id);
    user.lastActivePoiId = poiId;
    return this.usersRepository.save(user);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    const user = await this.findOne(id);
    user.avatarUrl = avatarUrl;
    return this.usersRepository.save(user);
  }

  async markLoggedIn(id: string): Promise<void> {
    const now = new Date();
    await this.usersRepository.update(id, { lastLoginAt: now, lastSeenAt: now });
  }

  async updateLanguage(id: string, language: Language): Promise<User> {
    const user = await this.findOne(id);
    user.language = language;
    return this.usersRepository.save(user);
  }
}
