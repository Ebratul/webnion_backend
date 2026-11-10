-- Local development only. The test suite creates webnion_test, and `prisma migrate dev` creates a temporary shadow
-- database to check each migration, so the app user may create and drop databases here. Never do this on a real server.
GRANT ALL PRIVILEGES ON *.* TO 'webnion'@'%';
FLUSH PRIVILEGES;
