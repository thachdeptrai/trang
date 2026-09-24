# TRĂNG — Living Mid-Autumn Sky

Website Trung thu tương tác chạy trên GitHub Pages + Supabase.

## V4

V4 thu gọn website về ba trải nghiệm chính:

- **Living Sky**: bầu trời đèn lồng realtime có chiều sâu, gió, glow và Presence.
- **Explore**: tìm kiếm, lọc chủ đề, sắp xếp mới nhất / nổi bật / sáng nhất.
- **Share Card**: tạo thiệp và chia sẻ bằng link.

## Wish Creator

Người dùng tạo điều ước theo 3 bước:

1. Viết tên + điều ước + chủ đề.
2. Chọn màu và kiểu đèn.
3. Preview rồi thả lên bầu trời.

Mỗi wish lưu:

- `category`: family / health / love / dream / luck / other
- `lantern_color`: amber / red / jade / blue / violet
- `lantern_style`: classic / round / lotus / diamond / tower

## Realtime

Supabase Realtime được dùng cho:

- điều ước mới;
- reactions;
- lượt **Thắp sáng**;
- Presence để hiển thị số người đang cùng ngắm trăng.

## Backend

Các object chính:

- `public.wishes`
- `public.wish_reactions`
- `public.wish_lights`
- `public.wish_reports`
- `public.wish_feed` — view aggregate dùng `security_invoker = true`

Frontend đọc `wish_feed` theo trang thay vì tải hàng nghìn reactions về browser để tự cộng.

### Quyền public

Khách không cần đăng nhập có thể:

- đọc wish/feed;
- gửi wish;
- reaction;
- thắp sáng một wish;
- gửi report.

Khách **không có quyền**:

- update/delete wish;
- đọc danh sách report;
- truy cập secret/service-role key.

`wish_reports` là write-only đối với public.

## Frontend

- `index.html` — Living Sky + Creator + Explore + panel + thiệp.
- `style.css` — cinematic UI, pseudo-3D lanterns, responsive.
- `app.js` — Supabase, Presence, realtime, creator, feed, reactions, lights, reports, audio và effects.
- `supabase-config.js` — chỉ chứa Project URL + publishable key.
- `database/supabase.sql` — schema/RLS/view/realtime setup.

## Security

Chỉ dùng Supabase **publishable key** trên GitHub Pages. Không đưa `service_role` hoặc secret key vào repository.

Các bảng public đều bật RLS. View aggregate chạy với quyền caller bằng `security_invoker`.

## Deploy

GitHub Pages deploy từ:

- branch: `main`
- folder: `/(root)`

File `.nojekyll` giữ nguyên.
