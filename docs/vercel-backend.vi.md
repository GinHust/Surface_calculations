# Backend riêng trên Vercel

Backend của Surface Compute Lab chạy bằng Vercel Functions. Website chính tiếp tục ở GitHub Pages. Backend này không gọi hoặc sửa hệ thống KICETIC của repository tham khảo.

- Backend: https://surface-paper-analysis.vercel.app
- Kiểm tra dịch vụ: https://surface-paper-analysis.vercel.app/health
- API cho website: https://surface-paper-analysis.vercel.app/analyze
- Project quản lý: https://vercel.com/linhnhpt-8436s-projects/surface-paper-analysis

## Xác thực AI

Bản triển khai dùng `AI_PROVIDER=vercel`, `AI_MODEL=openai/gpt-5.4-mini`. Mỗi lần gọi, Vercel đưa token OIDC vào header của Function; backend chuyển token đó sang AI Gateway. Không cần đưa khóa OpenAI riêng vào trang web. Không lưu token OIDC từ một request để dùng cho các request sau.

Trong lần kiểm tra thực tế ngày 17/11/2026, `/health` xác nhận backend, cấu hình AI và token bảo vệ đã có. Tuy nhiên, AI Gateway trả **403**, yêu cầu tài khoản có thẻ thanh toán hợp lệ để mở credit miễn phí. Vì vậy chưa có lần phân tích AI thành công trên tài khoản này. Cấu hình không tự thêm thẻ, nâng gói hoặc bật tự nạp tiền.

Nếu chủ tài khoản muốn tiếp tục, mở AI Gateway trong dashboard Vercel để xem điều kiện và thêm thẻ trực tiếp tại Vercel. Tài liệu Vercel mô tả credit miễn phí có giới hạn; cần kiểm tra số dư và điều kiện hiện tại của chính tài khoản. Không coi đây là AI miễn phí không giới hạn. Nếu không thêm thẻ, backend vẫn phục vụ health và các bước chuẩn bị, còn lời gọi AI bị chặn.

## Kết nối website

1. Mở website → Problem & Conditions → Read papers & define a research problem → AI analysis connection. URL backend Vercel đã được điền mặc định.
2. Nhập **service access token**, là token bảo vệ backend riêng. Token được tạo trong quá trình triển khai và lưu ở biến môi trường Vercel `ANALYSIS_ACCESS_TOKEN`. Bản sao trên máy làm việc ở `server/.env.vercel`; file này bị Git và Vercel upload bỏ qua. Không commit hoặc gửi token vào chat.
3. Chọn paper, kiểm tra nội dung, nhập mục tiêu rồi chạy phân tích. Nếu Gateway báo cần thẻ hoặc hết credit thì xử lý trong dashboard trước; không cần sửa câu hỏi để vượt qua lỗi tài khoản.
4. Website giữ token truy cập trong bộ nhớ, không lưu qua lần tải lại. API key của nhà cung cấp và token OIDC không được gửi về trình duyệt.

`ai_configured: true` ở health chỉ cho biết có thông tin xác thực và model, không chứng minh tài khoản có credit hay model đã trả lời thành công.

## Triển khai và cập nhật

`api/analyze.mjs` và `api/health.mjs` là entrypoint Vercel. `vercel.json` giữ alias `/analyze`, `/health`; giới hạn thời gian Function phân tích là 240 giây. Backend xử lý cả JSON đã được Vercel parse lẫn request stream của chế độ Node độc lập. Giới hạn và kiểm tra trích dẫn giống nhau.

Biến môi trường production đã cấu hình:

| Biến | Vai trò |
|---|---|
| `AI_PROVIDER=vercel` | Chọn Vercel AI Gateway |
| `AI_MODEL=openai/gpt-5.4-mini` | Model được yêu cầu |
| `ALLOWED_ORIGINS=https://ginhust.github.io` | Origin frontend được phép gọi |
| `ANALYSIS_ACCESS_TOKEN` | Token bảo vệ backend, không công khai |

Project đã kết nối với repository GitHub `GinHust/Surface_calculations` để Vercel tự triển khai khi cập nhật nhánh production. Cũng có thể chạy `vercel --prod --yes` từ checkout đã liên kết. GitHub Pages vẫn dùng workflow hiện tại. Mã hỗ trợ gọi OpenAI trực tiếp nếu đặt `AI_PROVIDER=openai`, `OPENAI_API_KEY` và `OPENAI_MODEL`; đó là tùy chọn thay thế, có billing riêng.

`.vercelignore` loại `tmp/`, output cá nhân và các file `.env*` khỏi gói upload, bao gồm các bản tham khảo repository riêng đã đọc trong quá trình kiểm tra. Chỉ backend, module dùng chung và landing page dịch vụ được đưa vào bản triển khai. Các bài kiểm tra AI dùng phản hồi giả lập; lời gọi thật hiện bị chặn vì điều kiện tài khoản nói trên.

Tài liệu chính thức: [Vercel OIDC](https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc), [AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing), [Vercel Functions](https://vercel.com/docs/functions).
