import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Xếp thùng logistics',
  description: 'Tối ưu xếp hàng vào container ngay trên trình duyệt',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
