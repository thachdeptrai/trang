-- Run with a database owner in the SQL editor. Every test row is rolled back.
begin;
do $$
declare
 a text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 b text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 pa jsonb; pb jsonb; room jsonb; result jsonb; again jsonb; wish jsonb; game jsonb;
 code text; req uuid:=gen_random_uuid(); blocked boolean; before_count bigint;
begin
 select count(*) into before_count from public.wishes;
 pa:=public.trang_v5(a,'hello'); pb:=public.trang_v5(b,'hello');
 assert pa->>'id'<>pb->>'id', 'Guests must be independent';
 wish:=public.trang_v5(a,'wish',jsonb_build_object('name','V5 QA','message','Chúc mọi người một mùa trăng an lành.','category','family','color','amber','style','classic','request_id',req));
 again:=public.trang_v5(a,'wish',jsonb_build_object('name','V5 QA','message','Chúc mọi người một mùa trăng an lành.','category','family','color','amber','style','classic','request_id',req));
 assert wish->>'id'=again->>'id', 'Wish retry must be idempotent';
 assert (select count(*) from public.wishes)=before_count+1, 'One wish inserted';
 assert jsonb_array_length(public.trang_v5(a,'me')->'owned')=1, 'Owner sees wish';
 assert jsonb_array_length(public.trang_v5(b,'me')->'owned')=0, 'Other guest does not own wish';
 perform public.trang_v5(b,'save',jsonb_build_object('id',wish->>'id'));
 assert jsonb_array_length(public.trang_v5(b,'me')->'saved')=1, 'Saved wish persists';
 room:=public.trang_v5(a,'create_room','{"name":"Host QA","title":"Phòng kiểm tra"}');code:=room->>'code';
 blocked:=false;begin perform public.trang_v5(b,'room',jsonb_build_object('code',code));exception when others then blocked:=true;end;
 assert blocked, 'Room requires membership';
 perform public.trang_v5(b,'join_room',jsonb_build_object('code',code,'name','Guest QA'));
 blocked:=false;begin perform public.trang_v5(b,'launch',jsonb_build_object('code',code));exception when others then blocked:=true;end;
 assert blocked, 'Only host can launch';
 blocked:=false;begin perform public.trang_v5(a,'launch',jsonb_build_object('code',code));exception when others then blocked:=true;end;
 assert blocked, 'All online members must be ready';
 perform public.trang_v5(a,'ready',jsonb_build_object('code',code,'message','An lành','color','amber','style','classic'));
 perform public.trang_v5(b,'ready',jsonb_build_object('code',code,'message','Hạnh phúc','color','jade','style','classic'));
 result:=public.trang_v5(a,'launch',jsonb_build_object('code',code));again:=public.trang_v5(b,'room',jsonb_build_object('code',code));
 assert result->>'launch_at'=again->>'launch_at', 'Same authoritative timestamp';
 assert jsonb_array_length(result->'lanterns')=2, 'Both wishes captured';
 assert (result->>'round')::int=1, 'Round increments';
 blocked:=false;begin perform public.trang_v5(a,'launch',jsonb_build_object('code',code));exception when others then blocked:=true;end;
 assert blocked, 'Cannot double launch';
 game:=public.trang_v5(a,'game_start');
 blocked:=false;begin perform public.trang_v5(a,'game_finish',jsonb_build_object('id',game->>'id','hits','[0]'::jsonb));exception when others then blocked:=true;end;
 assert blocked, 'Cannot finish instantly';
 update trang_private.game_runs set started_at=clock_timestamp()-interval '25 seconds' where id=(game->>'id')::uuid;
 blocked:=false;begin perform public.trang_v5(b,'game_finish',jsonb_build_object('id',game->>'id','hits','[0]'::jsonb));exception when others then blocked:=true;end;
 assert blocked, 'Cannot claim another guest game';
 blocked:=false;begin perform public.trang_v5(a,'game_finish',jsonb_build_object('id',game->>'id','hits','[24]'::jsonb));exception when others then blocked:=true;end;
 assert blocked, 'Targets bounded to 0..23';
 result:=public.trang_v5(a,'game_finish',jsonb_build_object('id',game->>'id','hits','[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]'::jsonb));
 again:=public.trang_v5(a,'game_finish',jsonb_build_object('id',game->>'id','hits','[]'::jsonb));
 assert result=again and (result->>'points')::int=24, 'One game receipt, no double points';
 perform public.trang_v5(a,'buy','{"item":"stardust"}');
 perform public.trang_v5(a,'buy','{"item":"stardust"}');
 perform public.trang_v5(a,'equip','{"item":"stardust"}');
 result:=public.trang_v5(a,'me');
 assert (result->>'points')::int=4, 'Repeated purchase charges only once';
 assert result->>'equipped'='stardust' and result->'inventory'='["stardust"]'::jsonb, 'Inventory/equipment persists';
 blocked:=false;begin perform public.trang_v5(a,'buy','{"item":"royal"}');exception when others then blocked:=true;end;
 assert blocked, 'No overspending';
 blocked:=false;begin perform public.trang_v5(b,'equip','{"item":"stardust"}');exception when others then blocked:=true;end;
 assert blocked, 'Cannot equip unowned items';
end $$;
set local role anon;
do $$
declare key text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');blocked boolean:=false;
begin
 perform public.trang_v5(key,'hello');
 begin perform 1 from trang_private.profiles;exception when insufficient_privilege then blocked:=true;end;
 assert blocked, 'Private guest keys and points cannot be read directly';
end $$;
reset role;
rollback;
select 'V5 database integration checks passed; test data rolled back' as result;
