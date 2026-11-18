# Đọc paper bằng nhiều agent và tạo bản nháp DFT

## Liên kết thông tin đến paper

Mở **Paper & Evidence** trong menu, hoặc truy cập [trực tiếp bảng L01](https://ginhust.github.io/Surface_calculations/?view=evidence&paper=L01). Đây là một màn hình riêng, có bảng **thông tin → paper/mục nguồn → câu trích → đích nghiên cứu/file DFT**. Literature & Data có nút mở bảng của paper đang chọn; Multi-agent Reader có nút quay về các liên kết.

Các dữ liệu L01 đã lưu được hiển thị ngay, không cần AI. Tóm tắt phương pháp được ghi rõ là tóm tắt, không giả thành trích dẫn. Một đoạn ngắn về cutoff đã được đối chiếu trực tiếp với [§1 Method của bản arXiv v1](https://arxiv.org/html/2011.04921v1#S1) ngày 18/11/2026; bản đầy đủ vẫn phải mở ở paper gốc.

Để tạo thêm liên kết khi AI chưa hoạt động: chọn paper, bấm **Read / attach text for this paper**, tải PDF hoặc dán nội dung, rồi quay lại Paper & Evidence. Nhập trường/thông số, giá trị, câu trích nguyên văn và đích sử dụng. Hệ thống kiểm tra câu trích có trong đoạn nguồn trước khi lưu. **Source passage** mở đoạn nguồn; **Original paper** mở DOI/bài gốc. Nếu thay văn bản hoặc xóa paper, bản ghi cũ bị đánh dấu cần liên kết lại.

Xuất JSON giữ tên bài, DOI/URL, vị trí nguồn, câu trích và đích sử dụng. Gói DFT nháp có thêm `paper-links.json`. Đích sử dụng là ghi chú nghiên cứu; thông số nhập thủ công và tóm tắt thư viện không tự được chèn vào input DFT. Các liên kết lưu trong trạng thái trình duyệt; chưa có cơ sở dữ liệu dùng chung.

Trong **Problem & Conditions**, nhập mục tiêu và tìm paper, hoặc mở **Add your own paper / PDF** để thêm tiêu đề rồi tải PDF/TXT/MD. PDF được trích xuất trong trình duyệt; văn bản đã chọn được gửi tới backend khi chạy phân tích. Tối đa 6 paper, 120.000 ký tự. PDF scan cần OCR trước; kiểm tra lại bảng, công thức và thứ tự văn bản.

## Bốn agent thật ở backend

1. **Evidence reader** trích xuất nhận định được báo cáo và suy luận, với câu trích và vị trí nguồn.
2. **Methods reconstruction** chạy song song với reader: thu thập phương pháp, thông số có đơn vị rõ ràng, cấu trúc và dữ liệu thiếu. Không tự suy ra tọa độ.
3. **Calculation planner** nhận kết quả đã kiểm tra trích dẫn từ hai agent, đặt câu hỏi và lập đồ thị phụ thuộc cho relax/SCF/DOS/NEB.
4. **Scientific reviewer** kiểm tra đề xuất với văn bản gốc, đánh dấu mâu thuẫn, thông số chưa đủ bằng chứng và đầu vào thiếu. Agent này không tự phê duyệt để chạy DFT.

Mỗi lượt có bốn lời gọi model, ba giai đoạn, deadline chung 215 giây. Đây là các vai trò riêng trên cùng model đã cấu hình, không phải bốn nhà cung cấp AI độc lập. Tất cả văn bản paper và kết quả agent trước được coi là dữ liệu không tin cậy. Backend xác minh trích dẫn trước khi chuyển sang bước sau. Việc câu trích tồn tại không chứng minh suy luận khoa học hoặc con số được diễn giải đúng.

## Kết nối và sử dụng

- Mở **AI analysis connection**, nhập URL HTTPS kết thúc bằng `/analyze` và service access token. Token chỉ nằm trong bộ nhớ của tab, không nằm trong gói tải xuống. Xem [cấu hình backend](vercel-backend.vi.md).
- Chọn **Run multi-agent research**, đọc thông số và trích dẫn, trả lời câu hỏi rồi phân tích lại. Thay đổi đầu vào làm kết quả cũ hết hiệu lực.
- **Create reviewed model plan** chuyển câu hỏi, tham chiếu và thông số được báo cáo sang Research Planner để bổ sung từng cấu hình và tọa độ. Yêu cầu sửa từ reviewer chặn bước tạo plan cho đến khi phân tích lại. Những thông số không có bằng chứng vẫn trống.
- Chọn engine, đọc xác nhận và tải **DFT draft package (.tar)**. Giải nén bằng công cụ hỗ trợ TAR. Mỗi bước có thư mục riêng; manifest chứa phụ thuộc, bằng chứng và các điều kiện đang chặn.

Gói gồm `manifest.json`, `evidence.json`, `README.md` và các file `.draft`: VASP INCAR/KPOINTS hoặc QE pw.in. Không chuyển eV sang Ry hay dùng thông số của engine khác một cách tự động. Mesh được ghi kèm yêu cầu kiểm tra centering/shift. Cấu trúc, pseudopotential, endpoint NEB, CHGCAR cho DOS và cấu hình cluster phải được cung cấp đúng bài toán. Không có tọa độ hoặc năng lượng mới được tạo bởi AI, không có POTCAR/UPF được phân phối và không chạy solver/cluster.

Nếu AI Gateway thiếu credit hoặc bị chặn billing, website vẫn đọc văn bản được nhưng không chạy được các agent. Health chỉ xác nhận cấu hình; không chứng minh model đã trả lời. Chi phí bốn lời gọi mỗi lượt do backend/provider xử lý.

## Phát triển

`node --test tests/*.test.cjs` kiểm tra hợp đồng API, provenance, sai trích dẫn, phụ thuộc, đơn vị, gói TAR và kết quả hết hiệu lực. Model được giả lập trong test; không coi đây là xác nhận chất lượng một lần đọc paper thật.

Build bằng `python tools/build.py` hoặc `node tools/build.mjs`. GitHub Pages triển khai frontend; Vercel triển khai backend từ cùng repository.
