# KPI Frame Tracker

Ứng dụng web **tĩnh** (HTML/CSS/JS) để ước lượng tiến độ KPI theo **frame**: thời gian làm việc hiệu quả và mốc **hoàn thành dự kiến**, căn theo **ca làm chuẩn** (giống logic nội bộ KPI trong repo).

## Tính năng chính

- Nhập **ngày/giờ bắt đầu**, **tổng frame**, tốc độ dạng **mục tiêu/ngày** (÷ 8 giờ làm) hoặc **frame/giờ**.
- **Đệm an toàn** (%): thêm phút làm việc trước khi quy đổi sang lịch — hàng **ước tính an toàn**.
- **Chi tiết tính toán** sau khi bấm *Tính thời gian*: phút làm việc, căn mốc nếu nhập ngoài giờ ca.
- Tab khác (Rank & Frame, Thành viên): toast **Notyf** — xanh dương, icon cảnh báo (đang phát triển).
- **Lenis** làm mượt cuộn; thanh cuộn tùy biến màu dự án.

## Lịch làm việc (logic lõi)

- Ca: **08:30–12:00**, **13:00–17:30**; trưa **12:00–13:00** không tính; sau **17:30** sang ngày làm tiếp; **Chủ nhật** bỏ qua.
- Chi tiết implementation: `js/datetime.js`, quy tắc trong `.cursor/rules/02-time-work-schedule.mdc` và `04-deadline-core-logic.mdc`.

## Công thức (tóm tắt)

- `frame/phút = (frame/giờ) ÷ 60`
- `phút làm việc = tổng frame ÷ frame/phút` → `DateTime.addWorkingMinutes(...)`.

## Chạy cục bộ

Không cần build. Mở trực tiếp `index.html` **hoặc** phục vụ qua HTTP (khuyến nghị để CDN hoạt động ổn):

```bash
npx --yes serve .
```

Hoặc:

```bash
python3 -m http.server 8080
```

Rồi mở `http://localhost:3000` hoặc cổng tương ứng.

## Cấu trúc thư mục

| Đường dẫn | Mô tả |
|-----------|--------|
| `index.html` | Trang tính thời gian (entry chính) |
| `css/page-time-calculation.bem.css` | Giao diện BEM trang tính |
| `css/app-scroll.css` | Lenis + scrollbar |
| `css/notyf-kpi.css` | Tuỳ chỉnh Notyf |
| `js/calculator.js` | Công thức frame/phút/giờ |
| `js/datetime.js` | Deadline theo phút làm việc |
| `js/page-time-calculation.js` | Nối form ↔ logic |
| `js/smooth-scroll.js` | Khởi tạo Lenis |
| `docs/` | Tài liệu thiết kế / BA |

## Mobile

- Tab điều hướng **cuộn ngang** trên màn nhỏ; `viewport-fit=cover` và **safe-area** cho tai thỏ/notch.
- Vùng chạm tối thiểu ~**44px** cho tab và nút gửi.

## Giấy phép

Theo quyết định chủ repo — thêm `LICENSE` khi cần phân phối.
