# Gợi ý câu hỏi và tổng hợp bài toán nghiên cứu

Trong **Problem & Conditions**, dùng mục **Question suggestions & research synthesis** trước khi tạo đầu vào tính toán. Giao diện tiếp tục sử dụng tiếng Anh theo quy ước của hệ thống.

1. Nhập mục tiêu, khoảng trống nghiên cứu và giả thuyết có thể kiểm chứng. Xác định bề mặt, ô mô phỏng, số lớp, độ phủ và vị trí nitơ dự kiến.
2. Chọn các tài liệu làm bằng chứng. Hệ thống sắp xếp bốn nhóm câu hỏi theo số nguồn liên quan đã chọn, sau đó theo từ khóa mục tiêu. Điểm liên quan không phải mức độ tin cậy khoa học.
3. Chọn câu hỏi về di chuyển bề mặt, hấp phụ, đưa carbon vào mạng hoặc độ ổn định vị trí nitơ. Bản tổng hợp cập nhật khi nhập nội dung; nút **Synthesize / refresh model brief** cập nhật cả danh sách gợi ý.
4. Đọc **Proposed model brief**: mục tiêu, khoảng trống, giả thuyết, mô hình tính, đại lượng đích, tiêu chí đánh giá, điều kiện so sánh và giới hạn của từng nguồn đã chọn. Mục **Required before computation** chỉ ra dữ liệu cần bổ sung.
5. Chọn **Create model plan in Research Planner** để tạo bài toán mới, giữ nguyên các bài toán trước đó. Mô hình hấp phụ và phản ứng có bốn cấu hình, chia thành hai nhóm N-free/N-containing; mô hình độ ổn định có hai cấu hình cùng thành phần. Bổ sung tọa độ, vị trí nguồn, tham chiếu năng lượng và giao thức tính chung trong Planner, rồi chuyển sang Input Builder.
6. Dùng **Export research brief JSON** để lưu đầu vào và bản tổng hợp; dùng chức năng xuất/nhập JSON của Planner để sao lưu kế hoạch mô hình. Bản brief chưa có chức năng nhập lại riêng. Nội dung nhập được lưu qua cơ chế lưu trạng thái trình duyệt hiện có; nên xuất JSON để sao lưu.

Đây là bộ quy tắc lập kế hoạch minh bạch dựa trên kho tài liệu hiện tại. Nó chưa đọc hay tổng hợp toàn văn tài liệu mới và không gọi mô hình ngôn ngữ. Nội dung bằng chứng được giữ nguyên từ kho, bao gồm vị trí trích dẫn và cảnh báo. Các cấu hình tạo ra là đề xuất, chưa có tọa độ hoặc thông số hội tụ đã xác nhận; Planner tiếp tục báo thiếu dữ liệu. Với NEB, thành phần và thứ tự nguyên tử phải khớp trong từng đường phản ứng. So sánh hệ có/không có N qua chênh lệch rào cản của từng hệ, không trừ trực tiếp tổng năng lượng giữa hai thành phần khác nhau.

Chạy `python tools/build.py` để đồng bộ bản HTML tại thư mục gốc, `site/` và `docs/`. Chạy `node --test tests/*.test.cjs` để kiểm tra.
