import { DataSource } from 'typeorm';
import { config } from '../config';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import * as bcrypt from 'bcryptjs';

const dataSource = new DataSource({
  type: 'mysql',
  host: config().database.host,
  port: config().database.port,
  username: config().database.username,
  password: config().database.password,
  database: config().database.database,
  entities: [User, Permission, UserPermission],
  synchronize: true,
  logging: true,
});

async function seed() {
  console.log('🌱 Starting database seed...\n');

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const userRepository = dataSource.getRepository(User);

  // Clear existing users
  await userRepository.clear();
  console.log('🗑️  Cleared existing users\n');

  // Create users
  const users = [
    {
      name: 'Admin User',
      email: 'admin@school.com',
      password: 'admin123',
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
    },
    {
      name: 'Principal',
      email: 'principal@school.com',
      password: 'principal123',
      role: UserRole.MANAGEMENT,
      isActive: true,
      isVerified: true,
    },
    {
      name: 'John Teacher',
      email: 'teacher@school.com',
      password: 'teacher123',
      role: UserRole.TEACHER,
      isActive: true,
      isVerified: true,
    },
    {
      name: 'Jane Student',
      email: 'student@school.com',
      password: 'student123',
      role: UserRole.STUDENT,
      isActive: true,
      isVerified: true,
    },
    {
      name: 'Mr. Guardian',
      email: 'guardian@school.com',
      password: 'guardian123',
      role: UserRole.GUARDIAN,
      isActive: true,
      isVerified: true,
    },
  ];

  for (const userData of users) {
    const user = userRepository.create(userData);
    await userRepository.save(user);

    // Generate a simple hash for display (actual hash is stored in DB)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    console.log(`✅ Created ${userData.role}: ${userData.email}`);
    console.log(`   Password: ${userData.password} (hashed: ${hashedPassword.substring(0, 30)}...)\n`);
  }

  // ---- Seed permissions catalog ----
  const permissionRepository = dataSource.getRepository(Permission);

  const permissionCatalog = [
    { name: 'users.view', description: 'View users' },
    { name: 'users.create', description: 'Create users' },
    { name: 'users.edit', description: 'Edit users' },
    { name: 'users.delete', description: 'Delete users' },
    { name: 'results.view', description: 'View student results' },
    { name: 'results.edit', description: 'Edit student results' },
    { name: 'attendance.view', description: 'View attendance' },
    { name: 'attendance.edit', description: 'Edit attendance' },
    { name: 'settings.manage', description: 'Manage site settings' },
    { name: 'content.manage', description: 'Manage site content (pages, menus, sliders, staff)' },
  ];

  const permissionMap = new Map<string, Permission>();
  for (const perm of permissionCatalog) {
    let existing = await permissionRepository.findOne({ where: { name: perm.name } });
    if (!existing) {
      existing = await permissionRepository.save(
        permissionRepository.create(perm),
      );
    }
    permissionMap.set(perm.name, existing);
  }
  console.log(`✅ Seeded ${permissionMap.size} permissions\n`);

  // ---- Grant all permissions to admin (user id 1) ----
  const userPermissionRepository = dataSource.getRepository(UserPermission);
  const adminUser = await userRepository.findOne({ where: { role: UserRole.ADMIN } });
  if (adminUser) {
    await userPermissionRepository.delete({ user_id: adminUser.id });
    const allPermissions = Array.from(permissionMap.values());
    await userPermissionRepository.save(
      allPermissions.map((p) => ({
        user_id: adminUser.id,
        permission_id: p.id,
        assigned_by: adminUser.id,
      })),
    );
    console.log(`✅ Granted all permissions to admin (${adminUser.email})\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('│ Role       │ Email                    │ Password    │');
  console.log('─────────────────────────────────────────────────────────');
  console.log('│ Admin      │ admin@school.com         │ admin123    │');
  console.log('│ Management │ principal@school.com     │ principal123│');
  console.log('│ Teacher    │ teacher@school.com      │ teacher123  │');
  console.log('│ Student    │ student@school.com       │ student123  │');
  console.log('│ Guardian   │ guardian@school.com     │ guardian123 │');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
