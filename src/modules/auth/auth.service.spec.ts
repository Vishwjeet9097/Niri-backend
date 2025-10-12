import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { User, UserRole } from '../../entities/user.entity';
import { CreateUserDto, LoginDto } from './dto/auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.NODAL_OFFICER,
      stateUt: 'Maharashtra',
    };

    it('should register a new user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        ...createUserDto,
        id: 'user-id',
        password: 'hashed-password',
      });
      mockUserRepository.save.mockResolvedValue({
        ...createUserDto,
        id: 'user-id',
        password: 'hashed-password',
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(createUserDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('password');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: createUserDto.email } });
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.NODAL_OFFICER,
      stateUt: 'Maharashtra',
      isActive: true,
    };

    it('should login successfully with valid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('password');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUserById', () => {
    it('should return user if found and active', async () => {
      const mockUser = { id: 'user-id', isActive: true };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUserById('user-id');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id', isActive: true },
      });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUserById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-id',
        password: 'current-hashed-password',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hashed-password' as never);
      mockUserRepository.update.mockResolvedValue({});

      await service.changePassword('user-id', 'current-password', 'new-password');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-id' } });
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-id', {
        password: 'new-hashed-password',
      });
    });

    it('should throw UnauthorizedException for incorrect current password', async () => {
      const mockUser = {
        id: 'user-id',
        password: 'current-hashed-password',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.changePassword('user-id', 'wrong-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
