# TRĂNG — Điều ước dưới ánh trăng

Website Trung thu chạy trực tiếp trên GitHub Pages.

## Bản nâng cấp Moon Wishes V2

- Responsive mới cho desktop, tablet và mobile.
- Font stack an toàn hơn cho tiếng Việt, hạn chế lỗi ký tự.
- Header mobile riêng, sticky khi cuộn.
- Trăng động, halo, mây, sao, pháo sáng và hiệu ứng "Thắp sáng đêm trăng".
- Bầu trời điều ước chung: đọc dữ liệu từ Supabase, hiển thị thành đèn lồng, click để xem nội dung.
- Realtime: người khác vừa gửi điều ước thì đèn mới xuất hiện mà không cần F5.
- Bảng "Bầu trời của chúng mình" hiển thị điều ước gần nhất và thống kê.
- Điều ước công khai, không cần đăng nhập.
- Database chỉ cho public SELECT + INSERT; public không được UPDATE/DELETE.
- Giới hạn tên 40 ký tự, điều ước 180 ký tự và chống spam submit nhanh ở client.
- Thiệp Trung thu và link chia sẻ vẫn được giữ lại.

## Files chính

- `index.html`: giao diện.
- `style.css`: toàn bộ responsive + animation.
- `app.js`: UI, realtime, điều ước, thiệp, nhạc và hiệu ứng.
- `supabase-config.js`: URL + publishable/anon key dùng ở frontend.
- `database/supabase.sql`: schema + RLS + Realtime cho bảng `wishes`.
- `assets/moon-festival.webp`: ảnh nền.

## Database

Web là GitHub Pages nên database phải nằm ở dịch vụ ngoài. Bản V2 dùng Supabase PostgreSQL.

Chạy `database/supabase.sql` một lần trong Supabase SQL Editor, sau đó điền **Project URL** và **publishable/anon key** vào `supabase-config.js`.

Chỉ dùng publishable/anon key ở frontend. Không bao giờ đưa `service_role` hoặc secret key vào repository.

## Quyền dữ liệu

Khách truy cập có thể:

- xem điều ước;
- gửi điều ước mới.

Khách truy cập không thể:

- sửa điều ước đã có;
- xóa điều ước;
- chạy quyền quản trị database.

Điều ước là nội dung công khai, phù hợp với mục đích web vui/Trung thu.

## GitHub Pages

Deploy từ nhánh `main`, thư mục `/(root)`. File `.nojekyll` giữ nguyên.

