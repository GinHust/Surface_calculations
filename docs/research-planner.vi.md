# Thiết kế bài toán từ tài liệu nghiên cứu

Mở **Research Planner / 연구 설계** trong menu website. Phần này hỗ trợ tiếng Việt, tiếng Anh và tiếng Hàn; ngôn ngữ của hồ sơ có thể chọn riêng với giao diện tính toán hiện có.

Một vấn đề nghiên cứu chứa câu hỏi, tiêu chí kết luận, các bài báo liên quan, nhiều cấu hình, một bộ điều kiện tính dùng chung và các nhóm so sánh. Một bài báo có thể làm căn cứ cho nhiều vấn đề.

## Bắt đầu từ bài báo

1. Trong Literature, chọn bài rồi bấm **Use in problem definition**. Website liên kết bài vào vấn đề đang mở trong Research Planner.
2. Viết câu hỏi hẹp và đại lượng cần tính. Ví dụ: vị trí N ảnh hưởng thế nào đến năng lượng hấp phụ CH₃ trên cùng một mô hình diamond (100)?
3. Thêm từng cấu hình hoặc dùng mẫu hấp phụ / đường phản ứng. Các mẫu chỉ tạo hồ sơ hướng dẫn; không chứa tọa độ hay kết quả tính.
4. Ghi mặt tinh thể, termination, mô hình slab/supercell, vị trí N, chất hấp phụ, điện tích và spin. Ghi rõ hình/bảng/mục/file SI cung cấp cấu hình.
5. Đánh dấu nguồn cấu trúc: file tác giả, dựng lại từ bài báo hoặc mô hình đề xuất. Với cấu trúc dựng lại/đề xuất, ghi các giả định còn thiếu.
6. Gắn file POSCAR/CONTCAR/VASP/CIF/XYZ và dùng **Xem 3D** khi cần. Nhân bản hồ sơ không sửa tọa độ: nếu thay vị trí N hoặc chất hấp phụ, phải cung cấp file tương ứng.

## Chọn đúng nhóm so sánh

| Mục tiêu | Cấu hình A và B | Điều kiện chính |
|---|---|---|
| Độ bền tương đối | Hai cấu hình cùng thành phần | Cùng mô hình slab, ô mạng và protocol |
| Năng lượng hình thành | Hai cấu hình có thể khác thành phần | Phải khai báo thế hóa học/tham chiếu và quy ước liên quan |
| Hấp phụ | A là bề mặt sạch, B là bề mặt có hấp phụ | Cần tham chiếu chất hấp phụ; B phải bổ sung nguyên tử vào A |
| NEB | Trạng thái đầu và cuối của cùng bước phản ứng | Cùng thành phần, ô mạng, thứ tự nguyên tố; kiểm tra ánh xạ từng nguyên tử và kết quả tối ưu hai đầu |

Để nghiên cứu ảnh hưởng của N lên hấp phụ CH₃, tạo bốn cấu hình: bề mặt sạch không N, bề mặt không N có CH₃, bề mặt sạch có N và bề mặt có N có CH₃. Tạo hai nhóm hấp phụ và dùng cùng tham chiếu CH₃. Sau đó đối chiếu hai năng lượng hấp phụ; không lấy trực tiếp tổng năng lượng của hai hệ khác thành phần để kết luận.

Công cụ hiện yêu cầu hai cấu hình trong một nhóm có cùng mặt tinh thể, termination, mô hình slab, điện tích và spin. Các nghiên cứu thay đổi các điều kiện này cần tách nhóm và xây dựng protocol tham chiếu riêng. Công cụ chưa tự cân bằng phản ứng, tính thế hóa học hay xử lý hiệu chỉnh khuyết tật tích điện.

## Từ kế hoạch sang phép tính

Điền engine, functional, cutoff có đơn vị theo engine, lưới k, bộ pseudopotential và kế hoạch hội tụ. Khi đổi engine, cutoff và thông tin pseudopotential/hội tụ được xóa để tránh tái sử dụng nhầm đơn vị.

Website lập danh sách dự kiến: tối ưu từng cấu hình, tính năng lượng sau tối ưu và phép so sánh hoặc NEB phụ thuộc vào các kết quả liên quan. Đây là đồ thị phụ thuộc để chuẩn bị công việc, chưa phải bộ điều phối thực thi.

**Chuyển nhóm sang Input Builder** mang theo câu hỏi, cấu hình, hai đầu nếu có, tham chiếu, protocol và các điểm còn thiếu. `run-manifest.json` lưu ngữ cảnh này. Bộ input vẫn là bản nháp, chưa tự chèn tọa độ hay pseudopotential, chưa sẵn sàng chạy. Thay đổi ở màn hình điều kiện chỉ tác động tới bản nháp đang mở; sửa điều kiện của cả phép so sánh trong Research Planner.

Trạng thái “đủ hồ sơ để xem xét” chỉ có nghĩa các trường và một số điều kiện hình thức đã đủ. Cần người nghiên cứu kiểm tra mô hình vật lý, ánh xạ nguyên tử, hội tụ và tham chiếu. File CIF chỉ được xem trước; XYZ thiếu ô tuần hoàn. Dùng POSCAR khi cần kiểm tra thành phần, ô mạng và NEB trong planner.

## Lưu và chuyển dữ liệu

Hồ sơ và nội dung file tọa độ được lưu qua cơ chế lưu trạng thái của trang trong trình duyệt, khi khả dụng. Không có cơ sở dữ liệu dùng chung và không gửi cấu trúc lên máy chủ tính toán. Trạng thái lưu được hiển thị trên planner; nếu lưu không khả dụng, xuất JSON trước khi đóng.

Xuất toàn bộ hồ sơ JSON để sao lưu/chuyển máy; nhập JSON sẽ thêm các vấn đề vào danh sách với mã mới. Xuất danh sách phép tính để bàn giao kế hoạch và phụ thuộc. Giới hạn hiện tại: 8 vấn đề, 40 cấu hình và 40 nhóm mỗi vấn đề, 200 KiB/file tọa độ, tổng hồ sơ tối đa 1 MiB.
