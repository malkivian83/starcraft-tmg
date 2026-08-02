ALTER TABLE profiles
  ADD COLUMN nickname VARCHAR(32) NULL AFTER default_race,
  ADD COLUMN avatar VARCHAR(16) NULL AFTER nickname;
