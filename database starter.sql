-- NB: The 'database starter.sql' file has been replaced by 
-- this file (Bloom Steward-1730216530 (2))   
-- The insx in this file needed to be adjusted because it included 
-- "alter" commands that we no longer needed
-- and the field_tech_id needed to be made 'unique'
-- with these changes made to Bloom Steward-1730216530 (2) 
-- the query succeeded:
-- CREATE TABLE
-- CREATE TABLE
-- CREATE TABLE
-- ALTER TABLE
-- ALTER TABLE

DROP TABLE IF EXISTS client_visits CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS client_list CASCADE;

CREATE TABLE IF NOT EXISTS "user" (
	"id" serial NOT NULL UNIQUE,
	"username" varchar(100) NOT NULL UNIQUE,
    "password" VARCHAR (1000) NOT NULL,
	"user_type" bigint NOT NULL,
	PRIMARY KEY ("id")
);



CREATE TABLE IF NOT EXISTS "client_list" (
	"id" serial NOT NULL UNIQUE,
	"client_name" varchar(80) NOT NULL UNIQUE,
	"client_address" varchar(120) NOT NULL,
	"client_phone" varchar(14) NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_visits" (
    "id" serial NOT NULL UNIQUE,
    "client_id" bigint NOT NULL REFERENCES "client_list"("id") ON DELETE CASCADE,
    "field_tech_id" bigint NOT NULL REFERENCES "user"("id") ON DELETE SET NULL,
    "assigned_date" date DEFAULT CURRENT_DATE,
    "start_time" timestamp with time zone,
    "complete_time" timestamp with time zone,
    "timely_note" varchar(500),
    "timely_image" varchar(255),
    "tech_comment" varchar(500),
    PRIMARY KEY ("id")
);


    
UPDATE users SET password = 'Tom' WHERE email = 'marc@bloomsteward.com';
-- VALUES 
