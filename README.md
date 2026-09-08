# Xếp thùng logistics

Ứng dụng Next.js để nhập container/kiện hàng, tính phương án xếp trong Web Worker,
sau đó xem kết quả bằng mô hình 3D hoặc mặt bằng 2D. Dữ liệu và phương án được
tự lưu trên trình duyệt của máy đang dùng; thuật toán không gọi API hoặc lưu dữ liệu lên máy chủ.

## Luồng làm việc

1. **Nhập hàng hóa:** nhập tay hoặc chọn **Nhập file**. Mặc định tệp thay danh sách hiện tại; chọn **Thêm vào danh sách** nếu cần nối thêm hàng. Tên hàng, số lượng, tải trọng và quy tắc chồng kiện được giữ khi nhập.
2. **Thiết lập container:** dùng thư viện mẫu hoặc nhập đội container riêng. Khi nhập tệp container, ứng dụng tự chuyển sang dùng các container vừa nhập.
3. **Tối ưu:** chọn chiến lược rồi bấm **Tối ưu xếp hàng**. Có thể hủy khi đang tính. Sửa dữ liệu hoặc đặt lại sẽ hủy phép tính cũ, tránh nhận nhầm kết quả.
4. **Kiểm tra & xuất:** xem 3D/2D, phát lại trình tự, chọn và chỉnh vị trí kiện. Excel xuất đúng phương án đang hiển thị, kể cả các vị trí đã chỉnh tay. Có thể **Khôi phục cách xếp tự động** mà không cần tính lại.

Phiên làm việc tự lưu sau khi ngừng sửa trong khoảng 400 ms, gồm dữ liệu đầu vào,
phương án và các vị trí chỉnh tay. Tải lại trang sẽ khôi phục phiên mà không chạy
tối ưu lại. Trình duyệt không lưu được dữ liệu sẽ có thông báo rõ ràng.

Tệp Excel xuất gồm `Hang hoa`, `Container` thực tế được chọn, `Ket qua xep` và
`Hang chua xep` kèm lý do. Khi nhập lại tệp này, ứng dụng chọn đúng sheet theo
loại dữ liệu cần nhập. Dòng có số lượng lẻ, không dương hoặc tải trọng âm bị bỏ qua và báo lại.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

```bash
npm run test
npm run typecheck
npm run build
npm run e2e
```

`npm run build` xuất trang tĩnh vào thư mục `out/`, nên không cần chạy Node.js
server khi người dùng mở trang đã triển khai.

## Đưa lên GitHub Pages

Push nhánh `deploy-github` lên remote GitHub. Workflow
[deploy-pages.yml](.github/workflows/deploy-pages.yml) sẽ cài dependencies,
chạy kiểm thử, build static export và triển khai artifact lên GitHub Pages.

Trong repository GitHub, mở **Settings → Pages** và chọn **Source: GitHub
Actions** một lần. Khi workflow hoàn thành, trang công khai ở:

```text
https://daiz123d.github.io/lllogicstic.github.io/
```

## Giới hạn hiện tại

- Phiên lưu trên cùng trình duyệt và địa chỉ web; chưa đồng bộ giữa thiết bị. Xóa dữ liệu trình duyệt cũng xóa phiên đã lưu.
- Chưa có lịch sử nhiều phương án hoặc tính năng hoàn tác toàn bộ thao tác. **Đặt lại** thay phiên hiện tại bằng dữ liệu mẫu.
- Trình duyệt không hỗ trợ Web Worker sẽ dùng cách tính đồng bộ dự phòng. Cảnh 150 kiện đã được kiểm tra tương tác; chưa xác nhận tốc độ xử lý hoàn tất cho các đơn hàng lớn hơn.
- Thuật toán dùng heuristic xếp hàng, không bảo đảm nghiệm tối ưu toàn cục. Cảnh báo của phương án chỉnh tay cần được kiểm tra trước khi dùng; ghi đè cảnh báo không làm vị trí trở nên hợp lệ.
- Không có đăng nhập, database, GPS hoặc API backend.
- Nếu trình duyệt không có WebGL, người dùng vẫn xem được mặt bằng 2D.
