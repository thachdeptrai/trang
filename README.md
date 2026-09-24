# TRĂNG — Hẹn nhau dưới ánh trăng

Website Trung thu dành cho Ngọc Thạch. HTML, CSS, JavaScript thuần; không cần npm, framework, API key hay backend.

## Chạy ngay

Giải nén và mở `index.html`. Muốn dùng đường dẫn chia sẻ cho người khác, hãy đưa website lên GitHub Pages trước.

Hoặc dùng máy chủ tĩnh:

```sh
python -m http.server 8080
```

Mở `http://localhost:8080`.

## Tính năng

- Cảnh Trung thu gốc, tối ưu WebP; bố cục desktop và điện thoại.
- Sao chuyển động, pháo hoa, thả đèn ước nguyện.
- Nhạc nền ngũ cung tổng hợp bằng Web Audio; chỉ phát khi bấm bật.
- Ba mẩu ký ức Trung thu trong hộp thoại.
- Thiệp cá nhân hóa, sao chép/chia sẻ link; người nhận mở là thấy lời chúc.
- Giảm chuyển động theo cài đặt hệ thống, điều hướng bàn phím, nhãn biểu mẫu.
- Dừng hoạt ảnh/nhạc khi ẩn tab; giới hạn số hạt và độ phân giải canvas.

## GitHub Pages

Đẩy các file trong thư mục này lên nhánh `main` của repository public. Trong **Settings → Pages**, chọn **Deploy from a branch**, nhánh **main**, thư mục **/(root)** và bấm **Save**. Không cần chạy build. File `.nojekyll` giữ nguyên các tài nguyên tĩnh.

Nếu muốn dùng dòng lệnh với GitHub CLI đã đăng nhập, mở PowerShell tại thư mục đã giải nén rồi chạy `./publish.ps1`. Script sẽ tạo repository public tên `trang`, đẩy code, bật Pages và in URL từ API GitHub. Nếu tên đã tồn tại, script dừng để tránh ghi đè repository khác.

## Sửa nội dung

- `index.html`: câu chữ, tiêu đề, phần giới thiệu, footer.
- `style.css`: màu sắc, responsive, kích thước, chuyển động.
- `app.js`: lời chúc mẫu, nhạc, pháo hoa, xử lý thiệp và điều ước.
- `assets/moon-festival.webp`: ảnh nền gốc.

Tất cả đường dẫn tài nguyên là tương đối nên chạy được trong GitHub Pages project path.

## Quyền riêng tư & giới hạn

Điều ước cuối chỉ lưu trong localStorage trên thiết bị, không phải bảng điều ước công khai. Nội dung thiệp nằm trong phần `#card=` của URL; ai có link đều đọc được, không phải mã hóa bảo mật. Trang không gửi lời chúc qua email hay mạng xã hội tự động. Sao chép tự động phụ thuộc quyền clipboard; nếu bị chặn, link sẽ được chọn để sao chép thủ công.

## Assets

Ảnh nền tạo mới bằng OpenAI ImageGen cho dự án; nhạc được tổng hợp cục bộ, không lấy bản thu có bản quyền. Biểu tượng emoji dùng bộ chữ hệ điều hành nên có thể khác nhau giữa các thiết bị. Không có tracker, thư viện CDN, font hay ảnh tải từ bên thứ ba lúc chạy.

Các công cụ WebMCP có sẵn nếu trình duyệt hỗ trợ `document.modelContext`; trình duyệt thông thường vẫn dùng đầy đủ tính năng qua giao diện.
