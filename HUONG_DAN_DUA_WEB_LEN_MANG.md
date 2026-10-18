# ĐỖ LONG REVIEW — HƯỚNG DẪN ĐƯA WEBSITE LÊN MẠNG

## 1. Đưa mã nguồn lên GitHub

- Vào https://github.com/new, đăng nhập, nhập Repository name: `do-long-review`, chọn **Private**, bấm **Create repository**.
- Giải nén file ZIP đã tải về máy tính. Mở thư mục vừa giải nén.
- Trong kho GitHub mới, chọn **Add file → Upload files**. Kéo **toàn bộ các file trong thư mục** (không kéo nguyên ZIP) vào khung, rồi bấm **Commit changes**.
- Kiểm tra `Dockerfile`, `server.py`, `index.html`, `requirements.txt` đều ở cấp gốc kho (không nằm trong thư mục con).
- **Tuyệt đối không tải lên khóa API hay tệp `.env`**. `.env.example` chỉ là mẫu và không có khóa thực.

## 2. Kết nối Render

- Truy cập https://dashboard.render.com/, đăng nhập hoặc tạo tài khoản.
- Chọn **New → Web Service → Git Provider**, kết nối tài khoản GitHub nếu được hỏi, chọn repository `do-long-review`.
- Name: `do-long-review` (hoặc tên khác nếu bị trùng).
- Language/Runtime: **Docker** (Render dùng sẵn `Dockerfile`).
- Chọn **Free** để thử giao diện hoặc gói trả phí + Persistent Disk để giữ lịch sử lâu dài.
- Trong phần Environment thêm:
  - `OPENAI_API_KEY`: khóa bí mật lấy từ https://platform.openai.com/api-keys
  - `APP_ACCESS_CODE`: mã riêng do bạn tự đặt, không nên quá đơn giản.
  - `TEXT_MODEL`: `gpt-4.1-mini`
  - `VISION_MODEL`: `gpt-4.1-mini`
  - `TRANSCRIBE_MODEL`: `gpt-4o-mini-transcribe`
  - `DB_PATH`: `./studio.sqlite3` để test miễn phí. Nếu gắn ổ đĩa bền vững tại `/data` trên gói hỗ trợ, sửa thành `/data/studio.sqlite3`.
- Bấm **Create Web Service** và xem nhật ký triển khai. Khi trạng thái báo Live, Render cấp URL dạng `https://<ten-ban-chon>.onrender.com` (tên cụ thể có thể khác).

## 3. Kiểm tra trên điện thoại

- Mở URL do Render thực tế cấp bằng Chrome hoặc Safari.
- Chọn Viết Hook → nhập tên sản phẩm → thử tạo; kiểm tra Voice và Quét Văn Bản sau khi cấp quyền micro/camera.
- Vào URL chính + `/api/health` nếu cần kiểm tra máy chủ. `aiConfigured: true` nghĩa là máy chủ đã đọc biến `OPENAI_API_KEY`, không tự xác nhận API có thể thanh toán/thực hiện gọi model.
- iPhone: Safari → Chia sẻ → Thêm vào màn hình chính. Android: Chrome → menu → Thêm vào màn hình chính / Cài đặt ứng dụng.

## 4. Lưu ý quan trọng

- Render Free có thể ngủ sau 15 phút không dùng; thời gian bật lại có thể chậm khoảng 1 phút.
- **Render Free không có persistent disk**: SQLite và lịch sử web có thể mất khi máy chủ ngủ, khởi động lại hoặc cập nhật. Nếu cần web luôn nhớ lâu dài, dùng gói hỗ trợ Persistent Disk, mount `/data` và `DB_PATH=/data/studio.sqlite3`, hoặc nâng cấp ứng dụng sang DB ngoài.
- ChatGPT Plus và OpenAI API tính phí **riêng**. Cần thiết lập thanh toán/hạn mức API.
- TikTok có thể chặn lấy video qua link, hãy tải video có quyền sử dụng lên khi cần.
- Không có API chính thức gửi câu hỏi từ web vào đúng cuộc trò chuyện ChatGPT này. Mỗi web dùng AI qua API và lịch sử riêng.
- Mã truy cập đơn giản chưa phù hợp để mở cho nhiều người dùng. Nên bổ sung đăng nhập và rate limit nếu chia sẻ rộng.

Tài liệu gốc: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository ; https://render.com/docs/docker ; https://render.com/docs/free
