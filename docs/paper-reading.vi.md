# Từ paper đến định nghĩa bài toán tính toán

Backend riêng hiện đã triển khai trên Vercel. Xem [cấu hình Vercel và trạng thái kích hoạt AI thực tế](vercel-backend.vi.md); các hướng dẫn backend/Render dưới đây là phương án cấu hình ban đầu hoặc thay thế.

Luồng chính trong **Problem & Conditions** là **Read papers & define a research problem**. Các mẫu câu hỏi thủ công trước đây được giữ trong mục thu gọn **Manual question templates**.

## Luồng sử dụng

1. Nhập chủ đề/mục tiêu rồi chọn **Find papers for this topic**. Trong kết quả tìm kiếm, chọn **Read & define problem**. Abstract và thông tin nguồn được đưa về workspace đọc paper. Trang tìm kiếm độc lập cũng có thể chuyển paper về trang chính.
2. Đọc abstract, mở nguồn gốc, tải PDF hoặc dán các phần Methods, Results và SI. PDF được trích văn bản tại trình duyệt, giữ số trang PDF; không tự hiểu hình, bảng hay phương trình. PDF scan cần OCR trước. Hãy đối chiếu thứ tự đoạn văn, ký hiệu và số liệu với bản gốc. Phạm vi đọc luôn được ghi rõ: abstract, file tải lên hoặc phần văn bản người dùng dán; việc tải file không chứng minh tài liệu đầy đủ.
3. Nếu đã có dịch vụ AI, mở **AI analysis connection**, nhập URL HTTPS kết thúc bằng `/analyze` và service access token. API key của nhà cung cấp chỉ đặt trên server. Nút phân tích gửi văn bản đã chọn, mục tiêu và câu trả lời tới dịch vụ đó. Token truy cập dịch vụ chỉ nằm trong bộ nhớ, phải nhập lại khi tải lại trang; không có API key trong HTML hoặc GitHub.
4. Đọc các nhận định được phân loại thành **Paper reports** và **AI inference**. Mỗi nhận định phải có đoạn trích khớp với văn bản và vị trí nguồn. Trích dẫn không khớp khiến toàn bộ kết quả bị từ chối. Khớp đoạn văn chỉ chứng minh nguồn của trích dẫn, chưa chứng minh diễn giải đúng.
5. Trả lời câu hỏi về đối chứng, yếu tố thay đổi, đại lượng đích, điều kiện biên và dữ liệu còn thiếu. Phân tích lại sau khi thay đổi nội dung hoặc câu trả lời. Hệ thống chặn tạo mô hình từ kết quả cũ, câu hỏi chưa trả lời hoặc loại mô hình chưa xác định.
6. Kiểm tra bản định nghĩa đề xuất và đánh dấu đã xem xét trước khi tạo kế hoạch. Planner giữ nguồn paper trong JSON xuất/nhập, cấu hình đối chứng/điều trị và giả định. Tọa độ, tham chiếu năng lượng và thông số hội tụ chưa được tự suy ra. Chức năng này không chạy DFT.

Không có dịch vụ AI được cấu hình sẵn. Khi chưa kết nối, website chỉ cung cấp bước tìm kiếm, đọc văn bản, câu hỏi chuẩn bị và xuất phiên đọc JSON; giao diện không giả lập kết quả phân tích AI. JSON phiên đọc hiện chỉ hỗ trợ xuất, còn Planner hỗ trợ cả xuất và nhập.

## Tối ưu độ chính xác

- Ưu tiên paper gốc và SI. Không biến thông tin không có trong abstract thành một “khoảng trống nghiên cứu” đã được chứng minh.
- Mỗi nhận định có trích dẫn; tách kết quả tác giả báo cáo, diễn giải AI và giả thuyết cần kiểm tra. Ghi rõ chỗ thiếu chứng cứ và sự bất đồng giữa tài liệu.
- Hỏi làm rõ trước khi chọn mô hình. Cho phép `undetermined` khi bằng chứng chưa đủ hoặc mô hình cần thiết nằm ngoài các loại Planner hỗ trợ.
- Không tự áp dụng số liệu DFT chưa kiểm tra: đơn vị, phiên bản giả thế, spin/charge, điều kiện bề mặt và hội tụ phải được rà soát riêng.
- Kiểm tra thành phần và ánh xạ nguyên tử trong từng đường NEB; không lấy chênh lệch tổng năng lượng giữa hệ khác thành phần làm hiệu ứng nitơ. Phân biệt rào cản điện tử với rào cản năng lượng tự do.
- Hiện không có OCR, hiểu hình/bảng, truy xuất toàn văn qua paywall, đánh giá chuyên gia tự động hoặc bảo đảm đúng tuyệt đối. Cần đánh giá trên bộ paper đã được chuyên gia gán nhãn trước khi coi đây là công cụ phân tích nghiên cứu đáng tin cậy.

Giới hạn: sáu paper mỗi phiên, 10 MB mỗi PDF, tối đa 100 trang/PDF; 120.000 ký tự nội dung được gửi trong một lần phân tích. Dịch vụ không cắt ngầm nội dung vượt giới hạn. Để giảm chi phí và nhiễu, chọn các phần có liên quan cùng SI thay vì gửi cả phần tài liệu tham khảo. Hiện mỗi lần phân tích lại gửi toàn bộ phần đã chọn; chưa có kho truy xuất hay cache phân tích trên server.

## Kích hoạt backend AI

### Thiết lập nhanh với Render

1. Mở [Deploy to Render](https://render.com/deploy?repo=https://github.com/GinHust/Surface_calculations), đăng nhập Render và kết nối repository khi được yêu cầu. Cấu hình `render.yaml` đã chọn backend Node.js và gói Free; kiểm tra thông tin gói trước khi chấp nhận triển khai. Không cần chuyển website khỏi GitHub Pages.
2. Chuẩn bị API key của OpenAI trong tài khoản API riêng. Nhập trực tiếp vào `OPENAI_API_KEY` trên Render. Đặt `OPENAI_MODEL` thành ID model khả dụng cho tài khoản, có hỗ trợ Responses và Structured Outputs. Không nhập khóa API vào chat hoặc mã nguồn.
3. Chọn triển khai sau khi đã xem lại cấu hình. Khi dịch vụ chạy, Render cung cấp URL dạng `https://surface-paper-analysis-....onrender.com`. Mở URL đó với `/health`; phản hồi `{"status":"ok"}` xác nhận tiến trình đã chạy, chưa chứng minh kết nối AI hoạt động.
4. Trong phần Environment của dịch vụ, lấy giá trị `ANALYSIS_ACCESS_TOKEN` do Render tạo tự động. Đây là token bảo vệ backend riêng, khác provider API key.
5. Vào website → Problem & Conditions → Read papers & define a research problem → AI analysis connection. Nhập `https://<tên-dịch-vụ>.onrender.com/analyze` và service access token. Chọn một paper có văn bản rồi chạy phân tích để kiểm tra kết nối AI thật.

Render Free có thể tạm dừng dịch vụ khi không dùng, nên lần gọi đầu sau thời gian nghỉ có thể chậm. Hãy thử lại nếu lần đầu bị timeout. API AI có chi phí riêng với gói ChatGPT; kiểm tra billing và mức sử dụng trong tài khoản API. Cấu hình shortcut tắt tự triển khai backend sau mỗi push; dùng Manual Deploy trên Render khi cần cập nhật backend. GitHub Pages vẫn cập nhật theo workflow hiện có.

### Cấu hình dịch vụ riêng

Mã dịch vụ nằm ở `server/research-api.mjs`, dùng Node.js 24 và các thư viện chuẩn. Nó gọi Responses API với Structured Outputs và `store: false`, rồi kiểm tra lại từng trích dẫn. Nó không lưu paper trong cơ sở dữ liệu hay tự tải URL bên ngoài. Không ghi nội dung paper hoặc token vào log ứng dụng; chính sách lưu của nhà cung cấp API và hạ tầng hosting cần được kiểm tra riêng.

1. Triển khai thư mục repository lên một dịch vụ chạy Node.js có HTTPS. Đây là backend độc lập; GitHub Pages chỉ phục vụ frontend tĩnh.
2. Đặt biến môi trường riêng trên hosting theo `server/.env.example`: `OPENAI_API_KEY`, `OPENAI_MODEL` (model có hỗ trợ Responses và JSON Schema), `ANALYSIS_ACCESS_TOKEN` (token ngẫu nhiên mạnh), `ALLOWED_ORIGINS=https://ginhust.github.io`, và `PORT` theo hosting.
3. Start command: `node server/research-api.mjs`. Có thể chạy local với `node --env-file=server/.env server/research-api.mjs` sau khi tạo file `.env` riêng; file này bị Git bỏ qua.
4. Nhập URL `https://<backend-host>/analyze` cùng service access token trong workspace. Không đặt provider API key trong trường service access token.
5. Kiểm tra với paper được phép gửi tới dịch vụ; rà soát trích dẫn và câu trả lời trước khi dùng để nghiên cứu. Cấu hình model, chi phí và tài khoản API do chủ hệ thống quản lý. Bản hiện tại được kiểm thử với API giả lập; chưa kiểm thử bằng lời gọi model thật và chưa triển khai backend lên tài khoản hosting.

Backend yêu cầu origin hợp lệ và token truy cập, giới hạn sáu lần phân tích/phút/IP cho mỗi tiến trình. Khi triển khai nhiều tiến trình hoặc dùng proxy cần thêm xác thực người dùng và rate limit tại gateway; giới hạn trong bộ nhớ không phải cơ chế quota phân tán. Không công khai token dùng chung cho nhiều người.

Tài liệu API chính thức: [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [PDF.js](https://mozilla.github.io/pdf.js/examples/).
