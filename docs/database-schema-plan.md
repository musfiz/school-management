# Database Schema Refactoring Plan
## School Management System - User Permission Architecture

**Date:** September 1, 2026  
**Status:** Planning  
**Priority:** High (foundational for authentication, authorization, and academic features)

---

## Executive Summary

Refactor the authentication and user management system from a single monolithic `users` table into a cleaner structure that separates identity from profile data and uses direct permission assignment for authorization. This keeps the model simple for the current school management app while still supporting role-specific data tables for students, teachers, guardians, and management staff.

> **Review Note (2026-09-01):** This plan was verified against the actual codebase.
> - Database engine is **MySQL** (see [apps/api/src/database/data-source.ts](../apps/api/src/database/data-source.ts)), so DDL below follows MySQL syntax.
> - Migrations in this repo are written as TypeORM `MigrationInterface` classes using `Table` / `TableForeignKey` APIs, matching the style in [apps/api/src/database/migrations](../apps/api/src/database/migrations).
> - Existing column naming conventions use `name` and `password`, not `full_name` or `password_hash`, so the new tables follow the same pattern for consistency.

> **Update (2026-09-01):** The final approved design is a **direct permission model** only. There is no `roles` table, no `user_roles` junction table, and no `role_permissions` table for the current phase. Permission checks are based on direct assignment in `user_permissions`, while profile tables remain separate by user type.

---

## 1. Current State Analysis

### Current Issues
- All user types (administrator, management, teacher, guardian, student) are stored in a single `users` table
- The existing `role` field is not a strong long-term model because it becomes limiting as access rules become more detailed
- Authentication and academic/profile data are mixed together in one table
- Role-specific data such as student roll numbers, teacher qualifications, and guardian relationships become hard to manage cleanly
- Authorization is easier to scale when based on permissions rather than a single role column

---

## 2. Proposed Architecture

### Design Pattern: **Direct User Permission Model + User Type Profile Tables**

Users are assigned permissions directly through `user_permissions`. This is the simplest authorization model for the current requirement set and avoids unnecessary RBAC complexity until it is truly needed.

#### Core Tables

##### 2.1 Users Table (Authentication & Identity) — Keep Existing
The current `users` table remains the auth identity table. The `role` enum may stay temporarily if the app still relies on it, but the long-term direction is to treat permissions as the real authorization mechanism.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Responsibility:**
- Login credentials and authentication
- User identity (name, contact)
- Account activation and audit tracking
- Authorization is handled by direct permission assignments in `user_permissions`

---

##### 2.2 Permissions & Direct User Assignment — New

```sql
CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  assigned_by INT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Responsibility:**
- `permissions`: catalog of available actions or capabilities
- `user_permissions`: direct grant of a permission to a specific user
- Keeps authorization simple and explicit without role tables or inheritance logic

---

#### 2.3 Student Profile & Academic Data
Student and academic data remains isolated from authentication. Tables such as `students`, `results`, `exams`, and `subjects` are separate and linked to `users` using `user_id`.

```sql
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  roll_no VARCHAR(50) UNIQUE,
  class_id INT NULL,
  date_of_birth DATE NULL,
  admission_date DATE NULL,
  status ENUM('active','inactive','graduated','dropped') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id),
  INDEX idx_students_class_id (class_id)
);
```

**Child Tables:**

```sql
CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  term VARCHAR(50) NULL,
  exam_date DATE NULL,
  class_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  class_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  subject_id INT NOT NULL,
  marks DECIMAL(5,2) NOT NULL,
  grade VARCHAR(10) NULL,
  percentile DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_exam_subject (student_id, exam_id, subject_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  INDEX idx_results_exam_id (exam_id)
);

CREATE TABLE in_course_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  assessment_date DATE NULL,
  marks DECIMAL(5,2) NULL,
  type VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
```

---

##### 2.4 Teacher Profile
```sql
CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  employee_id VARCHAR(50) UNIQUE,
  department VARCHAR(100) NULL,
  qualification VARCHAR(255) NULL,
  date_of_joining DATE NULL,
  status ENUM('active','on_leave','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE teacher_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  class_id INT NOT NULL,
  academic_year VARCHAR(10) NULL,
  UNIQUE KEY uniq_teacher_subject_class_year (teacher_id, subject_id, class_id, academic_year),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);
```

---

##### 2.5 Guardian Profile & Student Relationship
```sql
CREATE TABLE guardians (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  relationship VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE guardian_students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guardian_id INT NOT NULL,
  student_id INT NOT NULL,
  relationship VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_guardian_student (guardian_id, student_id),
  FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_guardian_students_student_id (student_id)
);
```

---

##### 2.6 Management/Admin Profile
```sql
CREATE TABLE management (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  designation VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  employee_id VARCHAR(50) UNIQUE,
  date_of_joining DATE NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

> Note: an `admin` account may not need a management profile unless there are HR-style fields to store. In that case, it can remain as a plain `users` row with direct permissions assigned to it.

---

### 2.7 Reference Tables

```sql
CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  academic_year VARCHAR(10) NULL,
  section VARCHAR(10) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_class_name_year (name, academic_year)
);
```

---

## 3. Schema Diagram (Text Representation)

```
users (id, name, email, password, phone, is_active, is_verified)
  │
  ├─ user_permissions (user_id FK, permission_id FK, assigned_by, assigned_at)
  │       └─ permissions (id, name, description)
  │
  ├─ students (user_id FK UNIQUE, roll_no, class_id FK, dob, admission_date)
  │   ├─ results (student_id FK, exam_id FK, subject_id FK, marks, grade)
  │   │   └─ exams (id, name, term, exam_date, class_id FK)
  │   │   └─ subjects (id, name, code, class_id FK)
  │   ├─ in_course_marks (student_id FK, subject_id FK, marks, type)
  │   └─ guardian_students (guardian_id FK, student_id FK)
  │
  ├─ teachers (user_id FK UNIQUE, employee_id, department, qualification)
  │   └─ teacher_subjects (teacher_id FK, subject_id FK, class_id FK, year)
  │
  ├─ guardians (user_id FK UNIQUE, relationship, phone, address)
  │   └─ guardian_students (guardian_id FK, student_id FK)
  │
  └─ management (user_id FK UNIQUE, designation, department, employee_id)

classes (id, name, academic_year, section)
```

**Permission resolution:** A user's effective permissions are the direct permissions assigned to that user in `user_permissions`. This is simpler than a role-based model and fits the current requirement without unnecessary table overhead.

---

## 4. Implementation Strategy

### Phase 1: Database Migration (Week 1)

**Step 1.1:** Create new tables via TypeORM migrations
- Create `permissions`
- Create `user_permissions`
- Create `students`, `teachers`, `guardians`, `management`
- Create `classes`
- Create academic tables (`subjects`, `exams`, `results`, `in_course_marks`)
- Add foreign keys and indexes with `TableForeignKey`

**Step 1.2:** Data Migration (one-off script)
- Seed `permissions` with all needed capabilities such as `results.view`, `results.edit`, `users.manage`, `attendance.view`, etc.
- For each existing user, assign direct permission records in `user_permissions`
- Insert a corresponding profile row in `students`, `teachers`, `guardians`, or `management` if applicable
- Preserve audit timestamps where needed
- If the current `users.role` column remains temporarily, it can be treated only as a migration helper and removed later once direct permissions are fully populated

**Step 1.3:** Add Constraints & Indexes
- Foreign key constraints with `ON DELETE CASCADE`
- Unique constraints on `email`, `roll_no`, `employee_id`, and permission assignment keys
- Indexes on key joining columns for performance

### Phase 2: Backend API Updates (Week 2)

**Step 2.1:** Update TypeORM Entities
- Create `Permission` and `UserPermission` entities
- Create entities for each profile and academic table
- Add validation decorators with `class-validator`

**Step 2.2:** Refactor Auth Module
- Update `JwtStrategy` and `AuthService.login()` to load the user and their direct permissions
- Include `permissions: string[]` in the JWT payload or a second permission lookup after login
- Add `PermissionsGuard` and `@Permissions()` decorator for route-level access control

**Step 2.3:** Create Feature Services
- `StudentService` – results, in-course marks, class info
- `TeacherService` – subject assignments and teaching data
- `GuardianService` – linked students and relevant academic data
- `ManagementService` – administrative reports and user oversight

**Step 2.4:** Update Controllers
- Split endpoints by domain rather than by a rigid role model
- Use permission checks for fine-grained access control

### Phase 3: Frontend Updates (Week 3)

**Step 3.1:** Update Auth Flow
- Login returns the user plus a list of direct permissions
- Store the JWT and consume permission-based frontend route checks

**Step 3.2:** Update Dashboards
- Student dashboard: results, exams, in-course marks
- Teacher dashboard: assigned subjects, classes
- Guardian dashboard: linked students, their results
- Management dashboard: user and academic management views

**Step 3.3:** Update UI Permission Logic
- Use permission checks for page and action access
- Keep the UI simple and consistent with the permission model

---

## 5. Backend Implementation Details

### 5.1 Migration File Example

```typescript
// src/database/migrations/2026_09_02_000000_create_students_table.ts
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateStudentsTable1788400000000 implements MigrationInterface {
  name = 'CreateStudentsTable1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'students',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'int', isUnique: true },
          { name: 'roll_no', type: 'varchar', length: '50', isNullable: true, isUnique: true },
          { name: 'class_id', type: 'int', isNullable: true },
          { name: 'date_of_birth', type: 'date', isNullable: true },
          { name: 'admission_date', type: 'date', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'graduated', 'dropped'],
            default: "'active'",
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'students',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('students');
  }
}
```

### 5.2 TypeORM Entity Example

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ length: 255 })
  password!: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ default: false })
  is_verified!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ unique: true, length: 100 })
  name!: string;

  @Column({ nullable: true, length: 255 })
  description?: string;
}

@Entity('user_permissions')
export class UserPermission {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  user_id!: number;

  @Column({ type: 'int' })
  permission_id!: number;

  @Column({ type: 'int', nullable: true })
  assigned_by?: number;

  @CreateDateColumn({ type: 'timestamp' })
  assigned_at!: Date;
}
```

### 5.3 Auth Service Update

```typescript
async login(email: string, password: string): Promise<any> {
  const user = await this.usersRepository.findOne({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const permissions = await this.permissionRepository
    .createQueryBuilder('p')
    .innerJoin('user_permissions', 'up', 'up.permission_id = p.id')
    .where('up.user_id = :userId', { userId: user.id })
    .select('p.name', 'name')
    .getRawMany();

  const payload = {
    sub: user.id,
    email: user.email,
    permissions: permissions.map((item) => item.name),
  };

  return {
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      permissions: permissions.map((item) => item.name),
    },
  };
}
```

### 5.4 Permission Guard

```typescript
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    if (!requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredPermissions.every((perm) => user.permissions?.includes(perm));
  }
}
```

Controller usage:

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('results.edit')
@Patch('/results/:id')
async updateResult(@Param('id') id: number, @Body() dto: UpdateResultDto) {
  return this.resultsService.update(id, dto);
}
```

---

## 6. Migration Checklist

- [ ] Create TypeORM migration files for all new tables
- [ ] Run migration in development
- [ ] Seed `permissions` with the initial permission catalog
- [ ] Backfill `user_permissions` for existing users based on current business rules
- [ ] Add direct permission mapping for admin, teacher, guardian, and student access
- [ ] Create entities for `Permission`, `UserPermission`, and all profile/academic tables
- [ ] Add `PermissionsGuard` and `@Permissions()` route-level checks
- [ ] Update auth flow to load permission claims
- [ ] Test login flow and access rules end-to-end
- [ ] Update frontend to consume permission-based access
- [ ] Verify exceptions and temporary grants work via `user_permissions`

---

## 7. Security Considerations

1. **Password Storage:** Use bcrypt or argon2, never plaintext
2. **Permission Assignment:** Only trusted administration users should assign or revoke permissions
3. **Data Isolation:** Always filter by `user_id` in access queries
4. **Audit Trail:** Log permission grants and removals with `assigned_by` and `assigned_at`
5. **API Authorization:** Validate permissions for every protected endpoint using guards
6. **Guardian Access:** Guardian access should be limited to linked student records via `guardian_students`
7. **Permission Reviews:** Periodically audit whether the permission catalog is still clean and manageable

---

## 8. Recommended Decision

Proceed with this architecture:
- `users` = authentication and identity
- `students`, `teachers`, `guardians`, `management` = profile and domain-specific records
- `permissions` + `user_permissions` = authorization model
- no `roles`, `user_roles`, or `role_permissions` in the initial implementation

This is the right balance for this project: simple enough for a clean implementation, flexible enough for real permission controls, and aligned with the repo’s current MySQL + TypeORM setup.

---

## 9. Proposed Next Steps

1. Create the initial migration for `permissions` and `user_permissions`
2. Add `students`, `teachers`, `guardians`, and `management` tables
3. Seed the first permission catalog
4. Update the auth flow to load and validate permissions
5. Protect the first set of API routes with `@Permissions()` guards
6. Revisit a role layer only if business rules become truly role-based later
