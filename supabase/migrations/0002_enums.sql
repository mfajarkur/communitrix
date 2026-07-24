-- Create custom enum types for the application
create type sport_type      as enum ('PADEL','TENNIS');
create type match_type      as enum ('SINGLES','DOUBLES');
create type session_format  as enum ('AMERICANO','MEXICANO');
create type scoring_type    as enum ('POINTS','GAMES');
create type points_mode     as enum ('FIRST_TO_TARGET','FIXED_TOTAL','TIMED');
create type tie_policy      as enum ('ALLOW_DRAW','GOLDEN_POINT','WIN_BY_TWO');
create type session_status  as enum ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED');
create type round_status    as enum ('PENDING','ACTIVE','COMPLETED');
create type match_status    as enum ('SCHEDULED','IN_PROGRESS','AWAITING_CONFIRM','COMPLETED','VOIDED');
create type team_side       as enum ('A','B');
create type member_role     as enum ('ADMIN','MEMBER');
create type attendance      as enum ('ACTIVE','WITHDRAWN','NO_SHOW');
create type standings_metric as enum ('AVG_POINT_DIFF','TOTAL_POINTS','WINS');
