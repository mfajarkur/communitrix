-- Enable uuid-ossp for UUID generation
create extension if not exists "uuid-ossp";

-- Enable pgcrypto for cryptographic functions and gen_random_uuid()
create extension if not exists "pgcrypto";
