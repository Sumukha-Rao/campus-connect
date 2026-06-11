-- Campus Connect Database Schema

CREATE DATABASE IF NOT EXISTS campus_connect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus_connect;

SET FOREIGN_KEY_CHECKS = 0;

-- DROP TABLE IF EXISTS post_departments;
-- DROP TABLE IF EXISTS post_clubs;
-- DROP TABLE IF EXISTS stories;
-- DROP TABLE IF EXISTS bookmarks;
-- DROP TABLE IF EXISTS likes;
-- DROP TABLE IF EXISTS chat_messages;
-- DROP TABLE IF EXISTS chat_group_members;
-- DROP TABLE IF EXISTS chat_groups;
-- DROP TABLE IF EXISTS posts;
-- DROP TABLE IF EXISTS subscriptions;
-- DROP TABLE IF EXISTS channels;
-- DROP TABLE IF EXISTS clubs;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Users Table
-- Supports 3 Roles: 'admin', 'publisher', 'viewer'
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('admin', 'publisher', 'viewer') NOT NULL,
  department_id INT NULL,
  phone_number VARCHAR(15) NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Clubs Table
CREATE TABLE IF NOT EXISTS clubs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(15) UNIQUE NOT NULL,
  description TEXT NULL,
  logo_url VARCHAR(255) NULL,
  club_head_id INT NOT NULL,
  department_id INT NULL,
  is_restricted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_head_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Channels Table (Unified subscription target)
CREATE TABLE IF NOT EXISTS channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('department', 'club') NOT NULL,
  department_id INT NULL UNIQUE,
  club_id INT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT chk_channel_type CHECK (
    (type = 'department' AND department_id IS NOT NULL AND club_id IS NULL) OR
    (type = 'club' AND club_id IS NOT NULL AND department_id IS NULL)
  )
) ENGINE=InnoDB;

-- 5. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscriber_id INT NOT NULL,
  channel_id INT NOT NULL,
  status ENUM('pending', 'approved') NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sub (subscriber_id, channel_id),
  FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Posts Table
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  publisher_id INT NOT NULL,
  channel_id INT NULL, -- NULL means a college-wide broadcast by admin
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  level ENUM('college_wide', 'department', 'club', 'student_body') NOT NULL,
  type ENUM('meeting', 'event', 'hackathon', 'conference', 'seminar', 'workshop', 'circular') NOT NULL,
  image_url VARCHAR(255) NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  INDEX idx_publish_time (is_published, scheduled_at, expires_at),
  FULLTEXT INDEX idx_search (title, body)
) ENGINE=InnoDB;

-- 7. Chat Groups Table
CREATE TABLE IF NOT EXISTS chat_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  channel_id INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Chat Group Members Table
CREATE TABLE IF NOT EXISTS chat_group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  sender_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Likes Table
CREATE TABLE IF NOT EXISTS likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_like (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bookmark (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('subscription_confirmed', 'subscription_pending', 'subscription_approved', 'new_post') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_unread (user_id, is_read)
) ENGINE=InnoDB;

-- 13. Stories Table
CREATE TABLE IF NOT EXISTS stories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  publisher_id INT NOT NULL,
  media_url VARCHAR(255) NOT NULL,
  caption VARCHAR(200) NULL,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 1. Departments Data
-- Standard core engineering departments at RVCE
-- ============================================================================
INSERT INTO departments (id, name, code) 
SELECT 1, 'Computer Science and Engineering', 'CSE'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 1);

INSERT INTO departments (id, name, code) 
SELECT 2, 'Information Science and Engineering', 'ISE'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 2);

INSERT INTO departments (id, name, code) 
SELECT 3, 'Mechanical Engineering', 'ME'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 3);

INSERT INTO departments (id, name, code) 
SELECT 4, 'Electronics and Communication Engineering', 'ECE'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 4);

-- ============================================================================
-- 2. Users Data
-- Roles used: 'publisher' (HODs, Club Heads) and 'viewer' (Students)
-- ============================================================================
INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 1, 'hod_cse', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Dr. Shobha G', 'publisher', 1, '9876500001', 'hod.cse@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 2, 'hod_me', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Dr. Krishna M', 'publisher', 3, '9876500002', 'hod.me@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 2);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 3, 'kavya_debsoc', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Kavya Rao', 'publisher', 2, '9876500003', 'kavyar.is22@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 3);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 4, 'pranav_envisage', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Pranav K', 'publisher', 4, '9876500004', 'pranavk.ec21@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 4);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 5, 'bharath_student', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Bharath Gowda', 'viewer', 1, '9876500005', 'bharathg.cs23@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 5);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 6, 'shruti_student', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Shruti Iyer', 'viewer', 4, '9876500006', 'shrutii.ec23@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 6);

INSERT INTO users (id, username, password_hash, full_name, role, department_id, phone_number, email) 
SELECT 7, 'amith_student', '$2a$10$NCMYgCUAz/VvBoUlSq3ZBeyIanMcTllHlKAtweW0RVaWd3xTJjXby', 'Amith N', 'viewer', 3, '9876500007', 'amithn.me22@rvce.edu.in'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 7);

-- ============================================================================
-- 3. Clubs Data
-- Real cultural/tech clubs from RVCE
-- ============================================================================
INSERT INTO clubs (id, name, code, description, logo_url, club_head_id, department_id, is_restricted) 
SELECT 1, 'RV Debating Society', 'DEBSOC', 'Official debating and literary society of RVCE', '/uploads/debsoc_logo.png', 3, NULL, FALSE
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE id = 1);

INSERT INTO clubs (id, name, code, description, logo_url, club_head_id, department_id, is_restricted) 
SELECT 2, 'Envisage', 'ENVISAGE', 'AR/VR and Game Development Club', '/uploads/envisage_logo.png', 4, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE id = 2);

-- ============================================================================
-- 4. Channels Data
-- Creating both department and club channels
-- ============================================================================
INSERT INTO channels (id, type, department_id, club_id, name, description) 
SELECT 1, 'department', 1, NULL, 'CSE Notice Board', 'Academic and lab schedules for Computer Science'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE id = 1);

INSERT INTO channels (id, type, department_id, club_id, name, description) 
SELECT 2, 'department', 3, NULL, 'Mechanical Bulletins', 'Workshop and CAD lab updates'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE id = 2);

INSERT INTO channels (id, type, department_id, club_id, name, description) 
SELECT 3, 'club', NULL, 1, 'DebSoc Discussions', 'Model UN and debate competition announcements'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE id = 3);

INSERT INTO channels (id, type, department_id, club_id, name, description) 
SELECT 4, 'club', NULL, 2, 'Envisage AR/VR', 'Game jams, Unreal Engine workshops, and XR events'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE id = 4);

-- ============================================================================
-- 5. Subscriptions Data
-- ============================================================================
INSERT INTO subscriptions (id, subscriber_id, channel_id, status) 
SELECT 1, 5, 1, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 1);

INSERT INTO subscriptions (id, subscriber_id, channel_id, status) 
SELECT 2, 5, 4, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 2);

INSERT INTO subscriptions (id, subscriber_id, channel_id, status) 
SELECT 3, 6, 3, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 3);

INSERT INTO subscriptions (id, subscriber_id, channel_id, status) 
SELECT 4, 7, 2, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 4);

INSERT INTO subscriptions (id, subscriber_id, channel_id, status) 
SELECT 5, 7, 4, 'pending'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 5);

-- ============================================================================
-- 6. Posts Data
-- Using image_url (as updated in your schema)
-- ============================================================================
INSERT INTO posts (id, publisher_id, channel_id, title, body, level, type, image_url, is_pinned, scheduled_at, expires_at) 
SELECT 1, 1, 1, 'Update on DBMS Lab Evaluation', 'The final evaluation for the DBMS lab will be held next Tuesday. Bring your printed schemas.', 'department', 'circular', NULL, TRUE, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY)
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 1);

INSERT INTO posts (id, publisher_id, channel_id, title, body, level, type, image_url, is_pinned, scheduled_at, expires_at) 
SELECT 2, 2, 2, 'CNC Machine Workshop', 'A mandatory 2-day workshop on the new 5-axis CNC machine in the main workshop floor.', 'department', 'workshop', '/uploads/cnc_poster.png', FALSE, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY)
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 2);

INSERT INTO posts (id, publisher_id, channel_id, title, body, level, type, image_url, is_pinned, scheduled_at, expires_at) 
SELECT 3, 3, 3, 'RV Asian Parliamentary Debate', 'Registrations are open for the annual RV APD tournament. Cash pool of Rs. 30,000!', 'student_body', 'event', '/uploads/apd_poster.png', TRUE, NOW(), DATE_ADD(NOW(), INTERVAL 10 DAY)
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 3);

INSERT INTO posts (id, publisher_id, channel_id, title, body, level, type, image_url, is_pinned, scheduled_at, expires_at) 
SELECT 4, 4, 4, 'Unity 3D Game Jam', '48 hours to build a game. Theme will be announced on the spot. Pizza and Redbull on us.', 'club', 'hackathon', '/uploads/gamejam_poster.png', FALSE, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY)
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 4);

-- ============================================================================
-- 7. Chat Groups Data
-- ============================================================================
INSERT INTO chat_groups (id, name, description, channel_id, created_by) 
SELECT 1, 'DebSoc Core', 'Logistics planning for RV APD', 3, 3
WHERE NOT EXISTS (SELECT 1 FROM chat_groups WHERE id = 1);

INSERT INTO chat_groups (id, name, description, channel_id, created_by) 
SELECT 2, 'CSE 4th Sem Project Group', 'Discussions for the upcoming mini-projects', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM chat_groups WHERE id = 2);

-- ============================================================================
-- 8. Chat Group Members Data
-- ============================================================================
INSERT INTO chat_group_members (id, group_id, user_id, role) 
SELECT 1, 1, 3, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM chat_group_members WHERE id = 1);

INSERT INTO chat_group_members (id, group_id, user_id, role) 
SELECT 2, 1, 6, 'member'
WHERE NOT EXISTS (SELECT 1 FROM chat_group_members WHERE id = 2);

INSERT INTO chat_group_members (id, group_id, user_id, role) 
SELECT 3, 2, 1, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM chat_group_members WHERE id = 3);

INSERT INTO chat_group_members (id, group_id, user_id, role) 
SELECT 4, 2, 5, 'member'
WHERE NOT EXISTS (SELECT 1 FROM chat_group_members WHERE id = 4);

-- ============================================================================
-- 9. Chat Messages Data
-- ============================================================================
INSERT INTO chat_messages (id, group_id, sender_id, message) 
SELECT 1, 1, 3, 'Has the student union approved our budget for the trophy engraving?'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = 1);

INSERT INTO chat_messages (id, group_id, sender_id, message) 
SELECT 2, 1, 6, 'Yes, they signed the paper this morning. Ill collect the cheque from the accounts section.'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = 2);

INSERT INTO chat_messages (id, group_id, sender_id, message) 
SELECT 3, 2, 1, 'Students, ensure your mini-project abstracts are submitted by 5 PM today.'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = 3);

INSERT INTO chat_messages (id, group_id, sender_id, message) 
SELECT 4, 2, 5, 'Maam, can we use PostgreSQL instead of MySQL for the backend?'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = 4);

-- ============================================================================
-- 10. Likes Data
-- Students liking the Game Jam and Debate posts
-- ============================================================================
INSERT INTO likes (id, user_id, post_id) 
SELECT 1, 5, 4
WHERE NOT EXISTS (SELECT 1 FROM likes WHERE id = 1);

INSERT INTO likes (id, user_id, post_id) 
SELECT 2, 6, 3
WHERE NOT EXISTS (SELECT 1 FROM likes WHERE id = 2);

INSERT INTO likes (id, user_id, post_id) 
SELECT 3, 7, 4
WHERE NOT EXISTS (SELECT 1 FROM likes WHERE id = 3);

INSERT INTO likes (id, user_id, post_id) 
SELECT 4, 7, 2
WHERE NOT EXISTS (SELECT 1 FROM likes WHERE id = 4);

-- ============================================================================
-- 11. Bookmarks Data
-- Students saving important lab/workshop notices for later
-- ============================================================================
INSERT INTO bookmarks (id, user_id, post_id) 
SELECT 1, 5, 1
WHERE NOT EXISTS (SELECT 1 FROM bookmarks WHERE id = 1);

INSERT INTO bookmarks (id, user_id, post_id) 
SELECT 2, 7, 2
WHERE NOT EXISTS (SELECT 1 FROM bookmarks WHERE id = 2);

INSERT INTO bookmarks (id, user_id, post_id) 
SELECT 3, 6, 3
WHERE NOT EXISTS (SELECT 1 FROM bookmarks WHERE id = 3);

-- ============================================================================
-- 12. Stories Data
-- Temporary 24-hour visual updates by Club Heads/Publishers
-- ============================================================================
INSERT INTO stories (id, publisher_id, media_url, caption, expires_at) 
SELECT 1, 3, '/uploads/story_debsoc.png', 'Setting up the auditoriums for the finals! 🎤', DATE_ADD(NOW(), INTERVAL 24 HOUR)
WHERE NOT EXISTS (SELECT 1 FROM stories WHERE id = 1);

INSERT INTO stories (id, publisher_id, media_url, caption, expires_at) 
SELECT 2, 4, '/uploads/story_vr.png', 'New Meta Quest 3 headsets just arrived at the lab! 😎', DATE_ADD(NOW(), INTERVAL 12 HOUR)
WHERE NOT EXISTS (SELECT 1 FROM stories WHERE id = 2);

INSERT INTO stories (id, publisher_id, media_url, caption, expires_at) 
SELECT 3, 1, '/uploads/story_cse.png', 'Reminder: Bring your ID cards to the DBMS lab tomorrow.', DATE_ADD(NOW(), INTERVAL 6 HOUR)
WHERE NOT EXISTS (SELECT 1 FROM stories WHERE id = 3);
