# ĐỖ LONG REVIEW — AI Creator Studio

Bản web **mobile-first** gồm 5 công cụ: Viết Hook, Voice, Link TikTok, Công dụng sản phẩm, Quét văn bản. Giao diện có hiệu ứng chuyển sắc, phát phản hồi từng chữ qua streaming, copy một chạm, nút TikTok/Zalo, lưu lịch sử theo ID trình duyệt bằng SQLite.

## Điều quan trọng về kết nối ChatGPT

Không có API công khai để một website bất kỳ gửi tin nhắn **vào đúng cuộc trò chuyện ChatGPT trong trình duyệt** rồi đọc câu trả lời ngược lại. Đây là một cuộc hội thoại AI riêng qua **OpenAI API**, sử dụng hướng dẫn về cách viết hook và xử lý voice để bắt chước quy trình của người sở hữu. Lịch sử website **không đồng bộ** với lịch sử ChatGPT. Không nên dùng trình tự tự động đăng nhập, giả lập người dùng và quét trang chatgpt.com vì dễ mất ổn định và ảnh hưởng an toàn tài khoản.

## Khởi chạy trên máy tính

1. Cài Python 3.11+ và [FFmpeg](https://ffmpeg.org/download.html) (thêm vào PATH).
2. Mở terminal tại thư mục này, chạy:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

3. Sao chép `.env.example` thành `.env`, điền `OPENAI_API_KEY` **chỉ ở máy chủ**. Nếu dùng riêng, nên đặt `APP_ACCESS_CODE` để tránh người lạ gọi AI tốn phí.
4. Chạy `uvicorn server:app --host 0.0.0.0 --port 8000`. Mở `http://localhost:8000`.
5. Muốn điện thoại sử dụng camera, mic và truy cập từ bên ngoài: **deploy lên tên miền HTTPS**. Truy cập qua IP LAN HTTP có thể khiến camera/micro không hoạt động do yêu cầu bảo mật của trình duyệt.

## Dùng trên điện thoại ngoài internet

Có sẵn `Dockerfile`. Đưa toàn bộ thư mục lên một máy chủ chạy Docker (Railway, Render, VPS hỗ trợ Docker), đặt biến môi trường `OPENAI_API_KEY`, `APP_ACCESS_CODE`, `DB_PATH` và domain HTTPS. Nếu muốn dữ liệu lưu bền qua mỗi lần cập nhật máy chủ, **gắn persistent volume** rồi đặt `DB_PATH` tới đường dẫn volume, chẳng hạn `/data/studio.sqlite3`. Chưa có hosting hoặc API key thì giao diện mở được nhưng các chức năng AI báo cần kết nối.

Để ghim ứng dụng lên màn hình điện thoại: Safari iOS → Chia sẻ → Thêm vào Màn hình chính; Chrome Android → menu → Thêm vào màn hình chính / Cài đặt ứng dụng.

## Năm chế độ

- **Viết Hook:** nhập tên, tải ảnh, mô tả nỗi đau; AI đưa 6 hook, kịch bản 45–60s, CTA. Không bịa giá, đặc tính hay kết quả sử dụng.
- **Voice:** ghi qua micro hoặc tải audio/video; tự động nhận dạng tiếng Việt. Tùy chọn áp dụng viết tắt tùy chỉnh (m, t, TH, ngta, nv, m,ất d,ạy...) theo yêu cầu trước. Gõ lệnh chỉnh tiếp nếu cần.
- **Link TikTok:** dán đường dẫn công khai, nhận dạng âm thanh, sau đó yêu cầu viết lại hook/kịch bản. Nếu link bị chặn/riêng tư, có thể tải tệp video có quyền sử dụng lên. Công cụ dùng `yt-dlp`, **không cam kết đọc được mọi link TikTok**.
- **Công dụng SP:** lọc **chỉ** những ý được nhắc trong lời thoại nguồn. Không tự thêm công dụng hay coi khẳng định trong quảng cáo là dữ kiện y khoa.
- **Quét văn bản:** camera mặc định `user` (camera trước); có nút chuyển camera và tải ảnh. Nhận dạng chữ thông qua API AI; cần kiểm tra lại chữ khó.

## Bảo mật, chi phí và độ chính xác

- Máy chủ gửi dữ liệu AI bằng API key và tài khoản thanh toán OpenAI của bạn, **khác gói ChatGPT Plus**.
- **Không** điền API key vào HTML/JS hoặc chia sẻ `.env`; file `.dockerignore` đã loại trừ.
- `APP_ACCESS_CODE` là mã truy cập cơ bản cho nhóm nhỏ, **không** thay thế hệ thống đăng nhập, phân quyền và chống lạm dụng cần thiết nếu website công khai cho nhiều người. Khi đưa ra cộng đồng, hãy bổ sung bảo mật, xác thực, quota/rate limits, chính sách riêng tư và xử lý nội dung thích hợp.
- ID thiết bị và dữ liệu tại SQLite giúp giữ lịch sử làm việc trên **cùng trình duyệt**. Đổi thiết bị/xóa localStorage/chạy không có persistent disk sẽ không giữ cùng lịch sử. Không dùng như trí nhớ toàn năng. Hiện các file ảnh/audio tải lên không được lưu lâu dài.
- Nhận dạng tiếng nói/OCR tự động không thể cam kết tuyệt đối 100% không sót hoặc sai chữ. Cần so lại video/ảnh, nhất là tên riêng.
- `ffmpeg` giới hạn xử lý tối đa 30 phút; file gửi tối đa 75MB, ảnh 8MB.
- Chỉ xử lý video bạn có quyền sử dụng và tuân thủ điều khoản TikTok.

## Tùy biến giọng văn

Sửa `BASE_RULES`, `MODE_RULES` và `voice_format` trong `server.py` để bổ sung ví dụ chuẩn từ 2 cuộc chat share; liên kết share ChatGPT không phải API nguồn cung cấp toàn bộ hội thoại một cách ổn định.

## Các file

`index.html` giao diện, `styles.css` thiết kế & hiệu ứng, `app.js` tương tác, `server.py` API & SQLite, `requirements.txt`, `Dockerfile`, `.env.example`, `manifest.webmanifest`, `icon.svg`.
