# Xếp thùng logistics

Ứng dụng Next.js để nhập container/kiện hàng, tính phương án xếp ngay trong
trình duyệt, sau đó xem kết quả bằng mô hình 3D hoặc mặt bằng 2D. Thuật toán
không gọi API và không lưu dữ liệu lên máy chủ.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

```bash
npm run test
npm run build
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

- Dữ liệu chỉ nằm trong tab trình duyệt và mất khi tải lại trang.
- Không có đăng nhập, database, GPS hoặc API backend.
- Nếu trình duyệt không có WebGL, người dùng vẫn xem được mặt bằng 2D.
