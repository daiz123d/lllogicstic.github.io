# Hybrid Isometric Cutaway Viewer Design

## Mục tiêu

Thay viewer wireframe bằng một công cụ kiểm tra xếp container rõ ràng, nhẹ và chính xác. Người vận hành phải thấy được vị trí, thứ tự xếp, hàng bị che, vùng trống, tải trọng, kiện chưa xếp và lỗi kiểm tra mà không cần mô hình kho photorealistic.

## Phạm vi và ràng buộc

- Giữ nguyên thuật toán đóng gói, chính sách chọn container, toạ độ đầu ra, dữ liệu nhập và định dạng xuất hiện có.
- Dùng Next.js, React Three Fiber, Drei và Three.js `0.183.2` đang cài trong dự án. Không hạ Three.js về r134 vì sẽ phá vỡ R3F/Drei hiện có.
- Không thêm physics engine, texture ảnh nặng, bloom hoặc phản chiếu mạnh.
- Duy trì 3D/2D, chọn từ bảng kết quả, playback timeline và fallback khi WebGL không hỗ trợ.
- Cảnh báo/gizmo chỉnh tay là lớp xem và xác thực; chỉ lưu thay đổi hợp lệ khi người dùng chủ động áp dụng.
- Mục tiêu hiệu năng là gần 60 FPS với dữ liệu thông thường; các lớp đắt tiền chỉ tính khi người dùng bật.

## Kiến trúc

`PackingViewer` trở thành bộ điều phối UI và trạng thái quan sát. Các đơn vị render tách rõ trách nhiệm:

- `viewer-model.ts`: tính khung camera, bounds, chỉ số tải trọng/thể tích, màu heatmap, empty regions và trạng thái kiểm tra từ `PackedContainer`/`Placement`.
- `container-scene.tsx`: camera, vỏ cutaway, khối hàng, chọn/hover/focus, cảnh báo, gizmo và các lớp scene.
- `viewer-viewports.tsx`: viewport isometric, top/front/side, picture-in-picture và Quad View cùng một nguồn selection.
- `viewer-controls.tsx`: mode, visibility vỏ, preset camera, fit, HUD và điều khiển quan sát.
- `PackingWorkspace`: giữ `selectedPlacementId`, `step` và nhận callback chỉnh tay hợp lệ; thuật toán packing không bị gọi lại bởi thao tác xem.

## 1. Camera và khung hình

- Mặc định dùng `OrthographicCamera` với góc isometric nhìn từ trên, trước và bên phải; elevation 32 độ.
- `fitContainer` tính frustum theo bounding box container, mục tiêu container chiếm 75% viewport (cho phép 70–80%). Hàm chạy lúc đổi container, đổi số kiện hiển thị hoặc khi bấm nút `Vừa khung hình`; không ghi đè thao tác orbit bình thường.
- Chuột trái orbit, chuột phải pan, con lăn zoom. Ngăn context menu bên trong canvas.
- Double-click một kiện để focus camera vào kiện, vẫn giữ scale đủ thấy các kiện lân cận. Bấm `Vừa khung hình` trở về toàn bộ container.
- Camera presets gồm Isometric, Top, Front và Side; preset có thể dùng trong main viewport hoặc mini viewport.

## 2. Vỏ container cutaway

- Vỏ gồm floor, rear, left, right, roof, front/opening và đường khung cyan dịu.
- Mặt trước mặc định ẩn; vách sau đặt ở cuối container đối diện cửa xếp.
- Roof có opacity 10%; hai thành bên 15%; floor/rear đủ rõ để đọc không gian; edges cyan không bloom.
- Toolbar cho bật/tắt riêng left, right, roof, front và toàn bộ shell. Mở cửa đầu playback bằng animation 350 ms có thể tắt theo reduced motion.

## 3. Hàng hoá, hover và selection

- Kiện là solid boxes theo màu SKU trong palette nhất quán; wireframe chỉ là mode kỹ thuật.
- Mỗi kiện có cạnh mềm rất nhẹ, stroke mảnh và contact shadow cục bộ. Không dùng texture hoặc metalness/phản chiếu mạnh.
- Màu trạng thái: packed teal/blue, selected safety amber, moving cyan, invalid coral, unpacked gray.
- Hover hiển thị outline và tooltip tên, Dài × Rộng × Cao, khối lượng.
- Click chọn kiện: giảm saturation các kiện khác, hiện kích thước, X/Y/Z và hướng xoay quanh kiện; chọn đúng dòng trong bảng.
- Click dòng bảng hoặc double-click kiện focus đúng placement. Selection dùng khoá `containerId:order` hiện có.

## 4. Viewport và chế độ quan sát

- Main viewport là Isometric Cutaway. Hai PIP thu gọn mặc định là Top và Front; click PIP đổi nó thành main preset; mỗi PIP có nút thu gọn.
- Quad View hiển thị Isometric, Top, Front, Side; mọi viewport dùng chung data, step, shell visibility và selection.
- Toolbar modes: Solid, X-Ray, Wireframe, Heatmap tải trọng, Heatmap chiều cao, Khoảng trống và Exploded View.
- X-Ray giảm opacity vỏ và các lớp phía trước; heatmap thay material color, không thay màu dữ liệu gốc; space mode chỉ render empty-region transparent khi bật.
- Exploded View dịch lớp theo Y chỉ để quan sát và luôn hiển thị “Chế độ quan sát – không phải vị trí thực tế”. Tắt mode trả đúng placement coordinates.

## 5. Playback, HUD và cảnh báo

- Playback có Play/Pause, Previous, Next, tốc độ 0.5×/1×/2×, slider và nhãn `Bước n/t`.
- Trong khi phát, kiện vào từ ngoài cửa container theo easing 450 ms; kiện tiếp theo outline cyan, kiện vừa đặt glow ngắn. Camera không tự xoay.
- HUD canvas/DOM hiển thị thể tích đã dùng, tải trọng đã dùng/giới hạn, đã xếp, chưa xếp và toạ độ kiện đang chọn.
- Space mode hiển thị các vùng trống hình hộp xanh nhạt tính từ occupancy grid nội bộ; không chạy khi mode tắt.
- Kiện chưa xếp xuất hiện ở danh sách HUD màu gray/coral kèm lý do `oversize`, `overweight` hoặc `no-space`.

## 6. Chỉnh tay và xác thực

- Khi bật `Chỉnh tay`, kiện chọn có TransformControls: translate X/Y/Z, rotate X/Y/Z; snap 0.01 m, 0.05 m hoặc 0.10 m.
- Mọi preview gọi validator hiện có/adapter tương đương để phát hiện va chạm, vượt container, thiếu bề mặt đỡ và vượt tải.
- Lỗi gắn màu coral trên kiện và HUD. Nút áp dụng bị khóa khi không hợp lệ; chỉ chế độ Override được xác nhận rõ mới cho lưu ngoại lệ.
- Thay đổi hợp lệ cập nhật presentation layout cục bộ và bảng kết quả tương ứng, không thay thuật toán hay tự chạy lại tối ưu.

## 7. Khả năng truy cập, responsive và kiểm thử

- Các mode, visibility, viewport, fit, playback và chỉnh tay là button/checkbox có tên truy cập được; HUD quan trọng là DOM text.
- WebGL fallback giữ sơ đồ 2D, metrics và danh sách cảnh báo.
- Ở mobile, PIP chuyển thành menu chọn view, Quad View thành tabs để tránh canvas quá nhỏ; desktop giữ PIP/quad.
- Unit test cho model helpers: fit/frustum, bounds, heatmap, empty regions, HUD, manual validation adapter.
- Component test cho mode/visibility/selection/table sync/fallback/playback controls. Playwright smoke test cho camera fit, PIP/quad và selection focus trên browser thật.

## Thứ tự triển khai

1. Model/view state, camera orthographic và cutaway solid scene.
2. Selection/hover/detail, HUD, bảng đồng bộ, PIP/Quad và render modes.
3. Playback animation, space/heatmap/exploded states và shell controls.
4. Transform gizmo, snap, validation/override, browser smoke tests và performance pass.

## Tiêu chí nghiệm thu

- Container luôn chiếm khoảng 70–80% viewport sau Fit hoặc đổi dữ liệu, không còn lọt thỏm trong lưới.
- Người dùng nhìn/hover/click hoặc chọn bảng đều xác định được kiện, vị trí, kích thước, tải trọng, thứ tự và trạng thái.
- Cutaway mở được phía cửa; các vách/nóc bật tắt riêng; Top/Front/Side/Quad đồng bộ selection.
- Mọi mode quan sát không làm thay đổi packing coordinates; Exploded View nêu rõ đây không phải vị trí thực.
- Chỉnh tay không thể áp dụng vị trí lỗi nếu không bật Override; thuật toán chọn/xếp container và dữ liệu nhập không đổi.
