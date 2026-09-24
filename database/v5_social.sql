-- Additive V5 migration. Existing wishes/reactions remain unchanged.
-- Guest ownership uses a random 256-bit capability kept by the visitor.
-- Only its SHA-256 digest is stored. All mutations go through a bounded RPC.
create schema if not exists trang_private;
revoke all on schema trang_private from public, anon, authenticated;

create table trang_private.profiles (
 id uuid primary key default gen_random_uuid(), token_hash bytea not null unique,
 name text not null default 'Khách ngắm trăng', points integer not null default 0 check(points>=0),
 equipped text not null default 'plain', created_at timestamptz not null default now()
);
create table trang_private.owned_wishes (
 wish_id bigint primary key references public.wishes(id) on delete cascade,
 profile_id uuid not null references trang_private.profiles(id), created_at timestamptz not null default now(),
 request_id uuid not null, unique(profile_id,request_id)
);
create index owned_wishes_profile_idx on trang_private.owned_wishes(profile_id,created_at desc);
create table trang_private.saved_wishes (
 profile_id uuid not null references trang_private.profiles(id), wish_id bigint not null references public.wishes(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(profile_id,wish_id)
);
create table trang_private.rooms (
 code text primary key, host_id uuid not null references trang_private.profiles(id), title text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '24 hours'),
 launch_at timestamptz, round integer not null default 0, launch_payload jsonb not null default '[]'
);
create index rooms_host_created_idx on trang_private.rooms(host_id,created_at);
create table trang_private.room_members (
 room_code text not null references trang_private.rooms(code) on delete cascade,
 profile_id uuid not null references trang_private.profiles(id), name text not null,
 message text not null default '', color text not null default 'amber', style text not null default 'classic',
 ready boolean not null default false, last_seen timestamptz not null default now(),
 primary key(room_code,profile_id)
);
create table trang_private.game_runs (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references trang_private.profiles(id),
 started_at timestamptz not null default now(), finished_at timestamptz, seed integer not null,
 score integer not null default 0, awarded integer not null default 0
);
create index game_runs_profile_started_idx on trang_private.game_runs(profile_id,started_at desc);
create table trang_private.inventory (
 profile_id uuid not null references trang_private.profiles(id), item text not null,
 acquired_at timestamptz not null default now(), primary key(profile_id,item)
);
create table trang_private.point_ledger (
 id bigint generated always as identity primary key, profile_id uuid not null references trang_private.profiles(id),
 delta integer not null, reason text not null, ref text not null,
 created_at timestamptz not null default now(), unique(profile_id,reason,ref)
);
create index point_ledger_profile_idx on trang_private.point_ledger(profile_id,created_at desc);
alter table trang_private.profiles enable row level security;
alter table trang_private.owned_wishes enable row level security;
alter table trang_private.saved_wishes enable row level security;
alter table trang_private.rooms enable row level security;
alter table trang_private.room_members enable row level security;
alter table trang_private.game_runs enable row level security;
alter table trang_private.inventory enable row level security;
alter table trang_private.point_ledger enable row level security;
revoke all on all tables in schema trang_private from public,anon,authenticated;

create function public.trang_v5(p_token text, p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 p trang_private.profiles%rowtype; r trang_private.rooms%rowtype; g trang_private.game_runs%rowtype;
 ident bytea; nm text; msg text; col text; sty text; cat text; code text; item text;
 wid bigint; rid uuid; cost integer; n integer; earned integer; daily integer; score integer;
 result jsonb; entries jsonb; now_at timestamptz := clock_timestamp();
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Mã khách không hợp lệ.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 then raise exception 'Dữ liệu không hợp lệ.'; end if;
 ident := sha256(convert_to(p_token,'UTF8'));
 if p_action='hello' then
  insert into trang_private.profiles(token_hash) values(ident) on conflict(token_hash) do nothing;
 end if;
 select * into p from trang_private.profiles where token_hash=ident for update;
 if not found then raise exception 'Phiên khách chưa được khởi tạo.'; end if;
 if p_action in ('hello','me') then
  return jsonb_build_object('id',p.id,'name',p.name,'points',p.points,'equipped',p.equipped,
   'owned',coalesce((select jsonb_agg(to_jsonb(x)) from (select w.* from public.wish_feed w join trang_private.owned_wishes o on o.wish_id=w.id where o.profile_id=p.id order by o.created_at desc limit 100) x),'[]'::jsonb),
   'saved',coalesce((select jsonb_agg(to_jsonb(x)) from (select w.* from public.wish_feed w join trang_private.saved_wishes s on s.wish_id=w.id where s.profile_id=p.id order by s.created_at desc limit 100) x),'[]'::jsonb),
   'inventory',coalesce((select jsonb_agg(i.item) from trang_private.inventory i where profile_id=p.id),'[]'::jsonb),
   'ledger',coalesce((select jsonb_agg(to_jsonb(x)) from (select delta,reason,created_at from trang_private.point_ledger where profile_id=p.id order by created_at desc limit 12) x),'[]'::jsonb));
 elsif p_action='wish' then
  nm:=btrim(p_data->>'name'); msg:=btrim(p_data->>'message'); col:=p_data->>'color'; sty:=p_data->>'style';cat:=p_data->>'category';rid:=(p_data->>'request_id')::uuid;
  if rid is null or nm is null or length(nm) not between 1 and 40 or msg is null or length(msg) not between 1 and 180 then raise exception 'Tên 1–40 ký tự, điều ước 1–180 ký tự.';end if;
  select wish_id into wid from trang_private.owned_wishes where profile_id=p.id and request_id=rid;
  if found then return (select to_jsonb(w) from public.wish_feed w where id=wid); end if;
  if exists(select 1 from trang_private.owned_wishes where profile_id=p.id and created_at>now_at-interval '7 seconds') then raise exception 'Chờ 7 giây trước khi thả đèn tiếp.'; end if;
  if (select count(*) from trang_private.owned_wishes where profile_id=p.id and created_at>now_at-interval '1 day')>=30 then raise exception 'Bạn đã thả đủ 30 đèn hôm nay.'; end if;
  insert into public.wishes(name,message,category,lantern_color,lantern_style) values(nm,msg,cat,col,sty) returning id into wid;
  insert into trang_private.owned_wishes(wish_id,profile_id,request_id) values(wid,p.id,rid);
  update trang_private.profiles set name=nm where id=p.id;
  return (select to_jsonb(w) from public.wish_feed w where id=wid);
 elsif p_action='save' then
  wid:=(p_data->>'id')::bigint;
  if not exists(select 1 from public.wishes where id=wid) then raise exception 'Không tìm thấy đèn.';end if;
  if coalesce((p_data->>'saved')::boolean,true) then
   if (select count(*) from trang_private.saved_wishes where profile_id=p.id)>=100 then raise exception 'Bạn đã lưu đủ 100 đèn.';end if;
   insert into trang_private.saved_wishes(profile_id,wish_id) values(p.id,wid) on conflict do nothing;
  else delete from trang_private.saved_wishes where profile_id=p.id and wish_id=wid;end if;
  return jsonb_build_object('ok',true);
 elsif p_action='create_room' then
  nm:=btrim(p_data->>'name');msg:=btrim(p_data->>'title');
  if nm is null or length(nm) not between 1 and 40 or msg is null or length(msg) not between 1 and 60 then raise exception 'Điền tên và tên phòng hợp lệ.';end if;
  if (select count(*) from trang_private.rooms where host_id=p.id and created_at>now_at-interval '1 day')>=5 then raise exception 'Mỗi khách tạo tối đa 5 phòng/ngày.';end if;
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into trang_private.rooms(code,host_id,title) values(code,p.id,msg);
  insert into trang_private.room_members(room_code,profile_id,name) values(code,p.id,nm);
  return jsonb_build_object('code',code);
 elsif p_action in ('join_room','room','ready','launch','leave_room') then
  code:=upper(btrim(p_data->>'code'));
  select * into r from trang_private.rooms where rooms.code=code for update;
  if not found or r.expires_at<=now_at then raise exception 'Phòng không tồn tại hoặc đã hết 24 giờ.';end if;
  if p_action='join_room' then
   nm:=btrim(p_data->>'name');
   if nm is null or length(nm) not between 1 and 40 then raise exception 'Điền tên từ 1–40 ký tự.';end if;
   if (select count(*) from trang_private.room_members where room_code=code)>=20 and not exists(select 1 from trang_private.room_members where room_code=code and profile_id=p.id) then raise exception 'Phòng đã đủ 20 người.';end if;
   insert into trang_private.room_members(room_code,profile_id,name) values(code,p.id,nm) on conflict(room_code,profile_id) do update set name=excluded.name,last_seen=now_at;
  end if;
  if not exists(select 1 from trang_private.room_members where room_code=code and profile_id=p.id) then raise exception 'Bạn cần tham gia phòng trước.';end if;
  update trang_private.room_members set last_seen=now_at where room_code=code and profile_id=p.id;
  if p_action='leave_room' then
   if r.launch_at>now_at then raise exception 'Đang đếm ngược. Hãy chờ thả đèn xong.';end if;
   if r.host_id=p.id then
    select profile_id into rid from trang_private.room_members where room_code=code and profile_id<>p.id order by last_seen desc limit 1;
    if found then update trang_private.rooms set host_id=rid where rooms.code=code;else update trang_private.rooms set expires_at=now_at where rooms.code=code;end if;
   end if;
   delete from trang_private.room_members where room_code=code and profile_id=p.id;
   return jsonb_build_object('ok',true);
  elsif p_action='ready' then
   if r.launch_at>now_at then raise exception 'Đã chốt đèn cho lượt này. Chờ lượt tiếp theo nhé.';end if;
   msg:=btrim(p_data->>'message');col:=p_data->>'color';sty:=p_data->>'style';
   if msg is null or length(msg) not between 1 and 180 or col is null or col not in ('amber','red','jade','blue','violet') or sty is null or sty not in ('classic','round','lotus','diamond','tower') then raise exception 'Điều ước hoặc kiểu đèn chưa hợp lệ.';end if;
   update trang_private.room_members set message=msg,color=col,style=sty,ready=coalesce((p_data->>'ready')::boolean,true) where room_code=code and profile_id=p.id;
  elsif p_action='launch' then
   if r.host_id<>p.id then raise exception 'Chỉ chủ phòng được bắt đầu.';end if;
   if r.launch_at>now_at-interval '20 seconds' then raise exception 'Chờ màn thả đèn hiện tại kết thúc.';end if;
   if exists(select 1 from trang_private.room_members where room_code=code and last_seen>now_at-interval '90 seconds' and not ready) then raise exception 'Chờ mọi người đang online sẵn sàng.';end if;
   select jsonb_agg(jsonb_build_object('id',profile_id,'name',name,'message',message,'color',color,'style',style)) into entries from trang_private.room_members where room_code=code and ready and last_seen>now_at-interval '90 seconds';
   if entries is null then raise exception 'Chưa có chiếc đèn sẵn sàng.';end if;
   update trang_private.rooms set launch_at=now_at+interval '10 seconds',round=round+1,launch_payload=entries where rooms.code=code returning * into r;
   update trang_private.room_members set ready=false where room_code=code;
  end if;
  return jsonb_build_object('code',code,'title',r.title,'is_host',r.host_id=p.id,'round',r.round,'launch_at',r.launch_at,'server_time',now_at,'expires_at',r.expires_at,'lanterns',r.launch_payload,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('id',profile_id,'name',name,'ready',ready,'online',last_seen>now_at-interval '90 seconds')),'[]') from trang_private.room_members where room_code=code));
 elsif p_action='game_start' then
  select * into g from trang_private.game_runs where profile_id=p.id order by started_at desc limit 1;
  if found and g.finished_at is null and g.started_at>now_at-interval '40 seconds' then raise exception 'Ván trước chưa kết thúc. Thử lại sau ít giây.';end if;
  if (select count(*) from trang_private.game_runs where profile_id=p.id and started_at>now_at-interval '1 day')>=40 then raise exception 'Đã đủ 40 ván hôm nay.';end if;
  insert into trang_private.game_runs(profile_id,seed) values(p.id,floor(random()*1000000)::int) returning * into g;
  return jsonb_build_object('id',g.id,'seed',g.seed,'duration',24,'server_time',now_at);
 elsif p_action='game_finish' then
  select * into g from trang_private.game_runs where id=(p_data->>'id')::uuid and profile_id=p.id for update;
  if not found then raise exception 'Ván chơi không thuộc về bạn.';end if;
  if g.finished_at is not null then return jsonb_build_object('score',g.score,'awarded',g.awarded,'points',p.points);end if;
  if now_at<g.started_at+interval '23 seconds' or now_at>g.started_at+interval '5 minutes' then raise exception 'Thời gian ván chơi không hợp lệ.';end if;
  entries:=p_data->'hits';
  if entries is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries)>24 then raise exception 'Kết quả không hợp lệ.';end if;
  if exists(select 1 from jsonb_array_elements_text(entries) h where h !~ '^[0-9]{1,2}$' or h::int not between 0 and 23) then raise exception 'Mục tiêu không hợp lệ.';end if;
  select count(distinct h)::int into score from jsonb_array_elements_text(entries) h;
  select coalesce(sum(delta),0)::int into daily from trang_private.point_ledger where profile_id=p.id and reason='game' and created_at>=date_trunc('day',now_at);
  earned:=greatest(0,least(score,100-daily));
  update trang_private.game_runs set finished_at=now_at,score=score,awarded=earned where id=g.id;
  update trang_private.profiles set points=points+earned where id=p.id returning * into p;
  insert into trang_private.point_ledger(profile_id,delta,reason,ref) values(p.id,earned,'game',g.id::text);
  return jsonb_build_object('score',score,'awarded',earned,'points',p.points);
 elsif p_action in ('buy','equip') then
  item:=p_data->>'item';
  cost:=case item when 'stardust' then 20 when 'aurora' then 40 when 'royal' then 60 else null end;
  if p_action='equip' and item='plain' then update trang_private.profiles set equipped=item where id=p.id;return jsonb_build_object('ok',true);end if;
  if cost is null then raise exception 'Vật phẩm không hợp lệ.';end if;
  if p_action='buy' then
   if exists(select 1 from trang_private.inventory where profile_id=p.id and inventory.item=item) then return jsonb_build_object('ok',true);end if;
   if p.points<cost then raise exception 'Chưa đủ Moon Points. Chơi thêm một ván nhé.';end if;
   insert into trang_private.inventory(profile_id,item) values(p.id,item);
   update trang_private.profiles set points=points-cost where id=p.id;
   insert into trang_private.point_ledger(profile_id,delta,reason,ref) values(p.id,-cost,'purchase',item);
  else
   if not exists(select 1 from trang_private.inventory where profile_id=p.id and inventory.item=item) then raise exception 'Bạn chưa sở hữu vật phẩm này.';end if;
   update trang_private.profiles set equipped=item where id=p.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Thao tác không được hỗ trợ.';
end;
$$;
revoke all on function public.trang_v5(text,text,jsonb) from public;
grant execute on function public.trang_v5(text,text,jsonb) to anon,authenticated;
comment on function public.trang_v5(text,text,jsonb) is 'Bounded guest-capability API. Token digests, ownership, server-time rounds, point ledger and atomic purchases remain private.';
