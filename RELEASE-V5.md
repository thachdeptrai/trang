# TRĂNG V5

## Chức năng

- Font tiếng Việt được lưu cùng website, không phụ thuộc Google Fonts lúc tải trang. Có giấy phép đi kèm.
- Form 3 bước kiểm tra dữ liệu, khóa gửi trùng, khôi phục nháp trên thiết bị. Điều ước đã gửi lưu trên Supabase.
- Link `#wish=ID` mở đúng chiếc đèn. Sao chép link, lưu/bỏ lưu, Góc trăng hiển thị đèn của bạn và đèn đã lưu.
- Mỗi khách có mã ngẫu nhiên 256 bit. Database chỉ giữ SHA-256 của mã. Mã khôi phục mở cùng góc trăng trên thiết bị khác; ai có mã sẽ có quyền với góc trăng đó. Đừng chia sẻ mã này như link đèn. Đèn từ trước V5 vẫn được giữ ở bầu trời chung; không tự nhận quyền sở hữu các đèn cũ.
- Phòng bạn bè tối đa 20 người, có link mời và mã phòng. Chủ phòng bấm bắt đầu khi mọi người online đã sẵn sàng. Mọi máy dùng cùng thời điểm đếm ngược 10 giây từ server, đồng bộ mỗi 2,5 giây và khi quay lại tab. Phòng hết hạn sau 24 giờ; điều ước trong phòng lưu trong lượt thả riêng, không tự đăng lên bầu trời công khai. Chủ phòng rời phòng sẽ chuyển quyền cho một thành viên khác.
- Thiệp PNG vuông 1080 × 1080 hoặc story 1080 × 1920, xử lý tiếng Việt/xuống dòng. Link thiệp cũ tiếp tục hoạt động.
- Mini-game Gom sao: 24 giây, chuột/chạm/Enter. Server quản lý phiên, điểm, lịch sử, mua và dùng vật phẩm. Mỗi ván chỉ cộng điểm một lần, tối đa 100 điểm/ngày UTC, 40 ván/ngày. Có thử lưu lại khi mất mạng; kết quả quá 5 phút hết hạn và có thể chơi ván mới.
- Bộ sưu tập có Bụi sao / Cực quang / Kim nguyệt, trang trí chiếc đèn trong Góc trăng.

## Cài đặt / cập nhật database

Trang này không có bước build. Chạy HTTP server tại thư mục gốc để phát triển, ví dụ `python -m http.server 8000`, rồi mở `http://localhost:8000`.

Database mới: chạy `database/supabase.sql`, rồi `database/v5_social.sql` **một lần**. Database đang chạy V4 chỉ cần migration V5. Migration V5 đã được áp dụng trên project hiện tại. Không chạy lại CREATE TABLE/FUNCTION trên cùng database.

`supabase-config.js` chỉ chứa URL và publishable key. Không dùng service-role hoặc secret key trong frontend.

Các bảng trong `trang_private` không có quyền truy cập trực tiếp cho khách. RPC `trang_v5` là cổng có chủ đích: xác minh mã khách, giới hạn payload, kiểm tra chủ phòng/chủ ván, khóa giao dịch điểm. `search_path` được cố định rỗng. Security Advisor sẽ báo SECURITY DEFINER được gọi bởi anon/authenticated và RLS không có policy trong schema riêng: đây là thiết kế RPC + default-deny, không phải grant đọc bảng riêng. Tham khảo [SECURITY DEFINER advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) và [RLS default deny](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Điểm là giải trí: kết quả chạm được client gửi lên, server giới hạn thời gian, quyền sở hữu, số mục tiêu, cộng một lần và trần ngày. Đây không phải cơ chế chống gian lận cho giải thưởng/tiền thật. Mã khách mới tạo danh tính mới; chưa có chống spam theo IP/CAPTCHA. Các quyền public đọc/đăng/reaction/light/report V4 vẫn giữ tương thích.

## Kiểm tra

- `node --check app.js` và `node --check v5.js`.
- `tests/database-v5.sql`: kiểm tra ownership, retry điều ước, thành viên/chủ phòng, timestamp đồng loạt, kết quả game, idempotency điểm/mua hàng, không đủ điểm, quyền schema riêng. Chạy bằng database owner. Toàn bộ dữ liệu test nằm trong transaction và ROLLBACK.
- `tests/responsive.html`: khung iframe 360 / 390 / 768 / 1440px để kiểm tra media queries. Đây không thay thế kiểm tra trên thiết bị iOS/Android thật.

Realtime public sử dụng Supabase Postgres Changes + Presence như V4, bổ sung trạng thái subscription và tải bù 30 giây/khi mạng trở lại. Phòng dùng polling theo server time, không tuyên bố đồng bộ chính xác tuyệt đối khi mạng chậm.

## Tài nguyên

- Be Vietnam Pro + Noto Serif Display: Google Fonts, SIL OFL; đã subset giữ bộ ký tự tiếng Việt, chuyển WOFF. Giấy phép tại `assets/fonts/`.
- Supabase JS 2.117.1 UMD: jsDelivr npm distribution, MIT, lưu trong `assets/vendor/`.
- Ảnh nền: giữ lại `assets/moon-festival.webp` của dự án.
- Code V5 chia thành `v5.js`/`v5.css`; nền V4 tiếp tục nằm trong `app.js`/`style.css`.

GitHub Pages tiếp tục phát hành từ `main`, thư mục gốc, không đổi lịch sử cũ.
