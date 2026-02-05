-- Seed admin and tech accounts
insert into users (email, name, password_hash, role, must_change_password, managed_password, phone)
values
  ('admin@example.com', 'Admin', '$2a$10$DyGw51hzsDpowxaXq.fUU.DaBvyIPMttE7zDqy0y/JHFVSIM7yXae', 'admin', false, 'password', '612-555-1001'),
  ('jacob@b.com', 'Jacob Daniels', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'Jacob123', '612-555-2002'),
  ('sadie@b.com', 'Sadie Percontra', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '50293847', '612-555-3003'),
  ('chris@b.com', 'Chris Lane', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '71920485', '612-555-4004'),
  ('cameron@b.com', 'Cameron Diaz', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '12837465', '612-555-5005'),
  ('derek@b.com', 'Derek Jeter', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '90456123', '612-555-6006')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  must_change_password = excluded.must_change_password,
  managed_password = excluded.managed_password,
  phone = excluded.phone;

insert into service_routes (name)
values ('North'), ('South'), ('East'), ('West'), ('Central'), ('St. Paul')
on conflict (name) do nothing;

-- Assign one route per field tech
update service_routes set user_id = (select id from users where email = 'jacob@b.com') where name = 'North';
update service_routes set user_id = (select id from users where email = 'sadie@b.com') where name = 'South';
update service_routes set user_id = (select id from users where email = 'chris@b.com') where name = 'East';
update service_routes set user_id = (select id from users where email = 'cameron@b.com') where name = 'West';
update service_routes set user_id = (select id from users where email = 'derek@b.com') where name = 'Central';

-- Clients: 6 per route for North through Central, 6 for St. Paul (with geo coordinates)
-- Clear existing clients to avoid duplicates from previous seeds
delete from clients;

insert into clients (name, address, service_route_id, latitude, longitude) values
  ('Acme HQ', '761 58th Ave NE, Fridley, MN 55432', (select id from service_routes where name = 'North'), 44.9865, -93.2740),
  ('Marco Polo, LLC', '2017 103rd Lane NW, Coon Rapids, MN 55433', (select id from service_routes where name = 'North'), 44.9875, -93.2750),
  ('Sunset Mall', '789 Pine Rd', (select id from service_routes where name = 'North'), 44.9885, -93.2730),
  ('Club 9625', '1919 CR Blvd NW, Coon Rapids, MN 55433', (select id from service_routes where name = 'North'), 44.9855, -93.2760),
  ('Palm Vista Resort', '910 Sago Palm Way, Apollo Beach, FL 33572', (select id from service_routes where name = 'North'), 27.77822, -82.4138332),
  ('Riverwalk Lofts', '225 3rd Ave S', (select id from service_routes where name = 'North'), 44.9865, -93.2710),
  ('Cedar Ridge', '12 Cedar Ridge Rd', (select id from service_routes where name = 'South'), 44.9645, -93.3040),
  ('Pine Grove', '88 Pine Grove Ln', (select id from service_routes where name = 'South'), 44.9655, -93.3050),
  ('Maple Terrace', '14 Maple Terrace', (select id from service_routes where name = 'South'), 44.9665, -93.3030),
  ('Lakeside Towers', '900 Lake St', (select id from service_routes where name = 'South'), 44.9635, -93.3060),
  ('Summit Square', '210 Summit Ave', (select id from service_routes where name = 'South'), 44.9675, -93.3020),
  ('Greenway Commons', '320 Greenway', (select id from service_routes where name = 'South'), 44.9645, -93.3010),
  ('Bayview Center', '1400 Bayview Dr', (select id from service_routes where name = 'East'), 44.9455, -93.1840),
  ('Harbor Point', '602 Harbor Point Rd', (select id from service_routes where name = 'East'), 44.9465, -93.1850),
  ('Sunrise Lofts', '75 Sunrise Blvd', (select id from service_routes where name = 'East'), 44.9475, -93.1830),
  ('Stonebridge', '480 Stonebridge Ln', (select id from service_routes where name = 'East'), 44.9445, -93.1860),
  ('Oak Ridge', '815 Oak Ridge Ct', (select id from service_routes where name = 'East'), 44.9485, -93.1820),
  ('Riverbend', '63 Riverbend Pkwy', (select id from service_routes where name = 'East'), 44.9455, -93.1810),
  ('Cypress Court', '44 Cypress Ct', (select id from service_routes where name = 'West'), 44.9255, -93.3640),
  ('Silver Lake Plaza', '990 Silver Lake', (select id from service_routes where name = 'West'), 44.9265, -93.3650),
  ('Forest Hills', '221 Forest Hills Dr', (select id from service_routes where name = 'West'), 44.9275, -93.3630),
  ('Hillcrest', '300 Hillcrest Rd', (select id from service_routes where name = 'West'), 44.9245, -93.3660),
  ('Grandview', '777 Grandview Ave', (select id from service_routes where name = 'West'), 44.9285, -93.3620),
  ('Briarwood', '55 Briarwood Way', (select id from service_routes where name = 'West'), 44.9255, -93.3610),
  ('Seaside Villas', '18 Seaside Blvd', (select id from service_routes where name = 'Central'), 45.0065, -93.1440),
  ('Harborview', '901 Harborview Ln', (select id from service_routes where name = 'Central'), 45.0075, -93.1450),
  ('Marina Point', '150 Marina Point Rd', (select id from service_routes where name = 'Central'), 45.0085, -93.1430),
  ('Coral Springs', '402 Coral Springs Dr', (select id from service_routes where name = 'Central'), 45.0055, -93.1460),
  ('Palm Grove', '260 Palm Grove Ct', (select id from service_routes where name = 'Central'), 45.0095, -93.1420),
  ('Ocean Crest', '111 Ocean Crest Blvd', (select id from service_routes where name = 'Central'), 45.0065, -93.1410),
  ('Stone Gate', '88 Park Ave', (select id from service_routes where name = 'St. Paul'), 44.8645, -93.0940),
  ('Verde Plaza', '445 Elm St', (select id from service_routes where name = 'St. Paul'), 44.8655, -93.0950),
  ('Urban Roost', '67 Birch Ln', (select id from service_routes where name = 'St. Paul'), 44.8665, -93.0930),
  ('Crown Point', '202 Ash Pl', (select id from service_routes where name = 'St. Paul'), 44.8635, -93.0960),
  ('Royal Grove', '156 Willow Ave', (select id from service_routes where name = 'St. Paul'), 44.8675, -93.0920),
  ('Haven House', '39 Oak Ter', (select id from service_routes where name = 'St. Paul'), 44.8645, -93.0910)
on conflict do nothing;

-- Clean up old data before re-seeding (delete dependent data first)
delete from visit_submissions;
delete from visit_checklist;
delete from visit_state;
delete from visits;
delete from routes_today;

-- Visits: one per client, time slots spread through the day
insert into visits (client_id, scheduled_time)
select c.id, 
  case c.id % 6
    when 0 then '13:00'
    when 1 then '08:00'
    when 2 then '09:00'
    when 3 then '10:00'
    when 4 then '11:00'
    else '12:00'
  end as scheduled_time
from clients c
on conflict do nothing;

-- Checklist items for each visit
insert into visit_checklist (visit_id, key, label, done)
select v.id, x.key, x.label, false
from visits v
cross join (values ('watered','Watered Plants'),('pruned','Pruned and cleaned'),('replaced','Replaced unhealthy plants')) as x(key,label)
on conflict do nothing;

-- Today's routes: align clients to assigned techs (one per client)
insert into routes_today (user_id, client_id, scheduled_time)
select u.id, c.id, v.scheduled_time
from clients c
join service_routes sr on sr.id = c.service_route_id
join users u on u.id = sr.user_id
join lateral (select scheduled_time from visits where client_id = c.id limit 1) v on true
on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time;

-- Visit submissions with realistic data: 12-20 min durations, 3-6 miles per visit, 30% grey circles
-- Jacob (North route) - 6 visits, 12-20 min each, ~3-6 miles per visit, 30% grey
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002) end,
  'odometerReading', 45000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['J. Smith', 'J. Johnson', 'J. Williams', 'J. Brown', 'J. Davis', 'J. Miller'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'North'
on conflict do nothing;

-- Sadie (South route) - 6 visits, 12-20 min each, ~3-6 miles per visit, 30% grey
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002) end,
  'odometerReading', 50000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['S. Garcia', 'S. Rodriguez', 'S. Martinez', 'S. Lopez', 'S. Gonzalez', 'S. Hernandez'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'South'
on conflict do nothing;

-- Chris (East route) - 6 visits, 12-20 min each, ~3-6 miles per visit, 30% grey
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002) end,
  'odometerReading', 52000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['C. Anderson', 'C. Taylor', 'C. Thomas', 'C. Moore', 'C. Jackson', 'C. Martin'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'East'
on conflict do nothing;

-- Cameron (West route) - 6 visits, 12-20 min each, ~3-6 miles per visit, 30% grey
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002) end,
  'odometerReading', 48000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['C. White', 'C. Harris', 'C. Martin', 'C. Thompson', 'C. Garcia', 'C. Martinez'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'West'
on conflict do nothing;

-- Derek (Central route) - 6 visits, mostly green with 30% grey, some red for accountability
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', case 
    when random() > 0.65 then null
    when v.id % 3 = 0 then jsonb_build_object('lat', c.latitude + 0.002, 'lng', c.longitude + 0.002)
    else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002)
  end,
  'odometerReading', 55000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['D. Lee', 'D. Clark', 'D. Lewis', 'D. Walker', 'D. Hall', 'D. Allen'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'Central'
on conflict do nothing;

-- St. Paul route - 6 visits, 12-20 min each, ~3-6 miles per visit, 30% grey
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', ts_base - interval '1 minute' * (random() * 8 + 12)::int,
  'checkOutTs', ts_base,
  'checkInLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when random() > 0.65 then null else jsonb_build_object('lat', c.latitude + (random() - 0.5) * 0.0002, 'lng', c.longitude + (random() - 0.5) * 0.0002) end,
  'odometerReading', 51000 + (c.id % 6) * 3 + (random() * 2)::int,
  'onSiteContact', (array['U. Young', 'U. Hernandez', 'U. Lopez', 'U. Gonzalez', 'U. Wilson', 'U. Anderson'])[((c.id - 1) % 6) + 1]
), ts_base - interval '1 minute' * (random() * 8 + 12)::int
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
join lateral (select now() - interval '1 minute' * ((row_number() over (order by c.id) - 1) * 35)::int as ts_base) x on true
where sr.name = 'St. Paul'
on conflict do nothing;

-- Populate daily_start_odometer for each tech (creates entries so mileage delta can be calculated)
insert into daily_start_odometer (user_id, date, odometer_reading)
select u.id, (now()::date), 
  case 
    when u.email = 'jacob@b.com' then 45000
    when u.email = 'sadie@b.com' then 50000
    when u.email = 'chris@b.com' then 52000
    when u.email = 'cameron@b.com' then 48000
    when u.email = 'derek@b.com' then 55000
    else 51000
  end
from users u
where u.role = 'tech'
on conflict (user_id, date) do nothing;
