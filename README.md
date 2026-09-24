# TRĂNG — Wish Network V3

Website Trung thu chạy trực tiếp trên GitHub Pages, dùng Supabase cho bầu trời điều ước công khai và realtime.

## V3

Giao diện được rebuild theo hướng cinematic / control panel. Các section kể chuyện dài đã bỏ, giữ lại phần có tương tác.

### Wish Studio
- Nhập tên + điều ước.
- Chọn 1 trong 6 chủ đề: gia đình, sức khỏe, tình yêu, ước mơ, may mắn, khác.
- Chọn 1 trong 5 màu đèn.
- Preview chiếc đèn ngay khi nhập.
- Gửi thẳng lên database công khai.

### Live Sky
- Realtime INSERT qua Supabase.
- Tìm theo tên hoặc nội dung.
- Filter theo chủ đề.
- Sort mới nhất / cũ nhất / ngẫu nhiên.
- Bốc ngẫu nhiên một điều ước.
- Đèn lồng bay trong sky stage.
- Click đèn/card để mở chi tiết.
- Share deep-link cho từng điều ước.
- Thống kê tổng số, hôm nay, số đang hiển thị.
- Live ticker cho điều ước mới nhất.
- Hiện thêm theo từng batch.

### Interaction
- Light show + particles.
- Focus mode.
- Ambient sound tổng hợp bằng Web Audio.
- Responsive desktop / tablet / mobile.
- Hỗ trợ prefers-reduced-motion.

### Moon Card
- Tạo lời chúc riêng.
- Sinh link chia sẻ.
- Copy hoặc native share.
- Người nhận mở link thấy nội dung trong dialog.

## Database

Project Supabase production đã được nối bằng publishable key trong `supabase-config.js`.

Schema nằm tại:

`database/supabase.sql`

Public role:
- SELECT ✅
- INSERT ✅
- UPDATE ❌
- DELETE ❌

Không đưa `service_role` hoặc secret key vào frontend.

## Files

- `index.html` — UI V3.
- `style.css` — visual system + responsive + animation.
- `app.js` — Supabase, realtime, filter/search/share/lightshow/card/audio.
- `supabase-config.js` — Project URL + publishable key.
- `database/supabase.sql` — schema + RLS + Realtime.
- `assets/moon-festival.webp` — background asset.

## Deploy

GitHub Pages deploy từ `main` / `(root)`. Không cần build step.
