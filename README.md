# TRĂNG — Mid-Autumn Night

Website Trung thu tương tác chạy trực tiếp trên GitHub Pages + Supabase.

## V3

Trang được rút gọn lại thành 4 trải nghiệm chính thay vì nhiều section chữ:

1. **Thả đèn**
   - 5 màu đèn: amber, jade, rose, violet, blue.
   - Live preview trước khi gửi.
   - Điều ước lưu công khai vào Supabase.
   - Realtime trên tất cả trình duyệt đang mở.

2. **Bầu trời chung**
   - Đèn bay lấy dữ liệu thật từ database.
   - Click đèn hoặc card để xem điều ước.
   - Bắt ngẫu nhiên một điều ước.
   - Thắp sáng/reaction cho điều ước.
   - Mỗi visitor id chỉ reaction một lần cho mỗi điều ước.
   - Ticker realtime và thống kê tổng đèn / hôm nay / ánh sáng.

3. **Quẻ trăng**
   - Bộ bài tương tác.
   - Kết quả ngẫu nhiên để giải trí.
   - Không phải bói toán hay dự đoán thực tế.

4. **Thiệp + poster**
   - Tạo thiệp Trung thu bằng link riêng.
   - Web Share API khi trình duyệt hỗ trợ.
   - Tạo poster điều ước 1080×1350 trực tiếp bằng Canvas.
   - Xuất PNG trên thiết bị.

## Visual / UX

- Responsive desktop, tablet và mobile.
- Be Vietnam Pro + Noto Serif hỗ trợ tiếng Việt.
- Cinematic hero, moon core, orbit, glow, star canvas.
- Mouse parallax, cursor spotlight, 3D tilt.
- 3 theme màu đêm.
- Ambient music chỉ bật khi người dùng chủ động.
- Firework / moonlight interaction.
- Hỗ trợ prefers-reduced-motion.

## Database

Schema nằm tại:

`database/supabase.sql`

Bảng:

- `wishes`: tên, nội dung, màu đèn, thời gian.
- `wish_lights`: reaction công khai cho từng điều ước.

RLS:

- public SELECT: có.
- public INSERT: có.
- public UPDATE/DELETE: không.

Frontend chỉ dùng Supabase **publishable key**. Không đặt service role/secret key trong repository.

## Files

- `index.html`: cấu trúc UI.
- `style.css`: toàn bộ visual / responsive.
- `app.js`: realtime, reaction, poster, oracle, card share, animation, audio.
- `supabase-config.js`: public project configuration.
- `database/supabase.sql`: database schema và policies.
- `assets/moon-festival.webp`: background.

## Deploy

GitHub Pages deploy từ `main` / `(root)`.
