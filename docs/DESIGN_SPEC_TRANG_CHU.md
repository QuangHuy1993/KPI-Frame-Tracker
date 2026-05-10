# Đặc tả thiết kế — Trang chủ KPI Frame Tracker

**Phiên bản tài liệu:** 1.0  
**Đối tượng:** Designer, BA kế thừa, Frontend khi implement  
**Phạm vi:** Chỉ mô tả **giao diện trang chủ** (visual & UX). Không ràng buộc code/CSS hiện tại của dự án.  
**Tinh thần thương hiệu:** Nền **tươi sáng**, **tương phản rõ**, cảm giác **kính mờ (glass)** theo xu hướng giao diện **macOS mới** — trong suốt nhẹ, lớp phủ blur, viền sáng mảnh, chiều sâu bằng ánh sáng chứ không bằng màu đen đậm.

---

## 1. Vai trò BA — Bối cảnh & mục tiêu

### 1.1. Người dùng chính

- Nhân sự / quản lý theo dõi **khối lượng frame** và **deadline** theo lịch làm việc chuẩn.
- Cần vào trang chủ và **đi được 3 luồng** rõ ràng, không lẫn: **Tính thời gian**, **Cấu hình rank/frame**, **Cấu hình thành viên**.

### 1.2. Mục tiêu trang chủ

1. **Orientation:** User hiểu ngay đang ở đâu, làm việc tab nào.
2. **Task-first (tab 1):** Ưu tiên hành động “chọn người → nhập số liệu → xem kết quả”.
3. **Trust:** Kết quả thời gian/deadline hiển thị rõ, dễ đọc, không bị chìm trong nền.
4. **Scalability:** Sau này thêm field/bảng vẫn giữ được lưới và hệ màu.

### 1.3. Phạm vi nội dung từng tab (functional outline cho designer)

| Tab | Tên gợi ý (có thể tinh chỉnh copy) | Nội dung chính |
|-----|-------------------------------------|----------------|
| 1 | Tính thời gian | Chọn thành viên, ngày/giờ bắt đầu, tổng frame; tùy chọn nhập frame/giờ thủ công; nút tính; vùng kết quả (thời gian làm, deadline dự kiến). |
| 2 | Cấu hình rank & frame | Danh sách/cards rank; form thêm-sửa rank; mốc frame/giờ (có thể nhiều giá trị). |
| 3 | Cấu hình thành viên | Danh sách thành viên; gán rank; override tốc độ (optional). |

Designer được tự do đổi **từ ngữ nút/nhãn** miễn giữ đúng ý nghĩa cột trên.

---

## 2. Design system — Tổng quan

### 2.1. Grid layout (bố cục lưới chuẩn)

- **Desktop (≥1280px):** Lưới **12 cột**, gutter **24px**, margin hai bên **48px** (tối đa content width **1200px** hoặc **1280px** — chọn một và nhất quán).
- **Tablet (768–1279px):** Lưới **8 cột**, gutter **20px**, margin **32px**.
- **Mobile (≤767px):** Lưới **4 cột**, gutter **16px**, margin **20px**.

**Quy tắc căn chỉnh**

- Toàn bộ **header + tab + main** nằm trong cùng `max-width` container để tạo “cột trục” thẳng hàng.
- **Không** để tab full-bleed sát mép màn hình trên desktop; tab luôn thuộc cùng phạm vi grid với nội dung bên dưới.

### 2.2. Phân vùng trang (vertical rhythm)

Thứ tự từ trên xuống:

1. **Top bar / Hero nhỏ** (1 hàng): logo/tên sản phẩm + một dòng phụ đề (optional).
2. **Tab navigation — căn giữa** (khối riêng, nổi bật).
3. **Main panel** (khối kính): chứa nội dung tab đang chọn (form + kết quả + danh sách tùy tab).

Khoảng cách dọc đề xuất (8px base scale):

- Giữa hero và tab: **32px** (desktop), **24px** (mobile).
- Giữa tab và main panel: **24px**.
- Trong panel: **24–32px** giữa section lớn; **16px** giữa field nhỏ.

---

## 3. Glass aesthetic (macOS-style)

Mục tiêu: Cảm giác **lớp kính** đặt trên nền sáng có gradient/highlight — không phải flat trắng thuần.

### 3.1. Nền trang (background)

- **Layer 0:** Nền gradient nhạt, **chuyển sắc rõ** (ví dụ góc trên-trái sáng hơn, góc dưới-phải tông lạnh hơn) để tạo **depth**.
- **Layer 1 (optional):** Blobs/hình elip mờ, opacity thấp (~8–15%), màu accent — tạo “studio lighting” chứ không nền một màu.
- **Không** dùng nền xám đậm làm chủ đạo; độ sáng tổng thể **cao**.

### 3.2. Panel kính (glass card)

Đặc tả thị giác (design token gợi ý — dev có thể map sang CSS):

| Thuộc tính | Hướng dẫn |
|------------|-----------|
| Nền | `rgba(255, 255, 255, 0.55)` – `0.72` tùy độ “kính”; có thể pha thêm sắc xanh nhẹ `rgba(240, 252, 255, …)` |
| Blur | Backdrop blur **16px–28px** (desktop); mobile có thể giảm **12px–18px** tránh lag |
| Viền | Viền **1px** sáng: `rgba(255, 255, 255, 0.65)` phía trên-trái + viền tối nhẹ `rgba(15, 45, 70, 0.08)` phía dưới để tạo “lip” kính |
| Bóng | Shadow mềm, lan rộng: ví dụ `0 8px 32px rgba(15, 55, 90, 0.08)`, thêm highlight line mảnh phía trên panel |
| Bo góc | **16px–20px** cho panel chính; **12px–14px** cho control nhỏ |

### 3.3. Tab bar dạng “segmented glass”

- Tab là **một thanh bo tròn pill** hoặc **3 segment nối liền**, nằm **chính giữa** theo chiều ngang container (không trái lệch như sidebar).
- Trạng thái **active:** nền kính đậm hơn hoặc lớp accent nhạt **bên trong** segment + chữ **đậm hơn**.
- Trạng thái **inactive:** chữ contrast tốt trên nền kính (không xám quá nhạt).
- Hover: tăng độ sáng viền hoặc glow nhẹ **1–2px** — tinh tế.

---

## 4. Màu sắc — Tươi sáng & tương phản

### 4.1. Nguyên tắc

- **Contrast:** Body text đạt chuẩn đọc được (WCAG AA trên nền kính sáng).
- **Accent:** Một màu chính “năng lượng” (ví dụ xanh ngọc / cyan) + một màu phụ “ấm” (cam nhạt hoặc vàng chanh) chỉ dùng cho highlight/illustration — **không** dùng quá 3 màu bão hòa cùng lúc trong một card.
- **Semantic:** Thành công (xanh lá đậm vừa), cảnh báo (cam), lỗi/nguy (đỏ) — luôn có **icon hoặc nhãn chữ** kèm màu.

### 4.2. Bảng token gợi ý (đặt tên cho designer handoff)

| Token | Vai trò | Gợi ý |
|-------|---------|--------|
| `color.page.base` | Nền xa | gradient sáng, tông lạnh |
| `color.surface.glass` | Panel kính | trắng pha trong suốt |
| `color.text.primary` | Tiêu đề, số liệu | gần `#0B1220` |
| `color.text.secondary` | Phụ đề, hint | `#4B5F76` |
| `color.accent.primary` | CTA, tab active, focus | xanh ngọc/sapphire sáng |
| `color.accent.secondary` | Badge, illustration | cam pastel hoặc vàng chanh |
| `color.border.hairline` | Viền kính | trắng + alpha / xanh đen alpha |
| `color.state.success` | KPI on-track | xanh lá |
| `color.state.warning` | KPI warning | cam |
| `color.state.danger` | Trễ / risk | đỏ |

Designer có thể tinh chỉnh hex nhưng **phải giữ** tỷ lệ tương phản và tính “sạch” của nền sáng.

---

## 5. Typography

### 5.1. Thang type (desktop)

| Role | Gợi ý | Weight |
|------|--------|--------|
| Display / page title | 28–32px | Semibold |
| Section title (trong panel) | 18–20px | Semibold |
| Body | 15–16px | Regular |
| Label form | 12–13px | Medium, uppercase hoặc small-caps nhẹ |
| Mono / số deadline | 13–14px tabular | Medium |

**Quy tắc:** Số liệu quan trọng (deadline, tổng phút) dùng **font mono hoặc tabular nums** để căn đẹp.

### 5.2. Line height & độ dài dòng

- Body: **1.45–1.55**.
- Tiêu đề: **1.2–1.3**.
- Max width đoạn văn trong panel: **60–75ch** nếu có mô tả dài (tab 2/3).

---

## 6. Header trang chủ (micro-hero)

**Mục đích:** Nhận diện sản phẩm, không chiếm quá 15% chiều cao viewport trên laptop.

**Thành phần đề xuất**

- **Trái (hoặc giữa nếu minimalist):** Wordmark “KPI Frame Tracker” + tagline 1 dòng (tiếng Việt).
- **Phải (optional):** Chip trạng thái “Dữ liệu lưu cục bộ” hoặc icon nhỏ — **không** chen vào vùng tab.

**Style:** Typography display sạch; có thể thêm subtle gradient chữ (rất nhẹ) — tránh lòe loẹt.

---

## 7. Tab navigation — Spec chi tiết (trung tâm)

### 7.1. Vị trí & kích thước

- Căn **horizontal center** trong container grid.
- Width tab bar: **không** full width; ví dụ **min 520px – max 720px** trên desktop để trông như “điều khiển trung tâm”.
- Chiều cao mỗi tab: **44–48px** (touch-friendly).

### 7.2. Cấu trúc 3 tab

1. **Tab 1 — Tính thời gian** (icon đồng hồ / timeline — line icon, stroke 1.5px).
2. **Tab 2 — Rank & frame** (icon lớp / sliders).
3. **Tab 3 — Thành viên** (icon people).

Icon **optional** nhưng nếu có thì **cùng kích thước 20px**, cách text **8px**.

### 7.3. Trạng thái tương tác

- Default, Hover, Active, Focus-visible (outline rõ accent), Disabled (khi không có quyền — future).
- **Keyboard:** Tab order: Tab bar → nội dung panel → các nút primary.

---

## 8. Main panel (glass) — Layout theo tab

Dùng **grid 12 cột** *bên trong* panel cho từng tab.

### 8.1. Tab 1 — Tính thời gian làm

**Mục tiêu UX:** Một luồng dọc rõ: **Input → Tính → Output**.

**Đề xuất bố cục desktop (12 col)**

- **Hàng A — Form (span 7):**  
  - Dropdown thành viên (full width trong cột).  
  - Dưới dropdown: dòng **hint** rank/tốc độ mặc định (text secondary, 13px).  
  - Grid con 2 cột: `datetime-local` + `tổng frame`.  
  - Checkbox/toggle “Nhập frame/giờ thủ công”; khi bật hiện field số.  
  - Nút primary “Tính thời gian” — full width hoặc align trái theo grid; height 48px.

- **Hàng A — Kết quả (span 5):**  
  - Card con (glass lồng hoặc nền accent cực nhạt) với 2 **metric lớn**:  
    1. “Thời gian làm cần thiết” (số + đơn vị rõ).  
    2. “Dự kiến hoàn thành” (datetime nổi bật, mono).  
  - Micro-copy giải thích 1 dòng: “Đã loại trừ giờ nghỉ trưa, ngoài giờ và Chủ nhật” (nếu product chấp nhận hiển thị).

**Mobile:** Form và kết quả **xếp chồng**; kết quả ngay dưới nút để không phải scroll xa.

**Empty state:** Chưa tính — hiển thị placeholder minh họa (illustration line art nhạt) + “Nhập thông tin và bấm Tính”.

### 8.2. Tab 2 — Cấu hình rank & frame

**Đề xuất desktop**

- **Trái (span 5):** Form “Thêm / sửa rank”: mã rank, tên hiển thị, danh sách mốc frame/giờ (multi-input hoặc textarea chip).
- **Phải (span 7):** Bảng hoặc danh sách card rank; mỗi row: tên + badge rank + summary mốc; actions (sửa/xóa) icon button ghost.

**Visual:** Row hover có nền kính đậm hơn một nấc; delete cần confirm modal glass.

### 8.3. Tab 3 — Cấu hình thành viên

**Đề xuất desktop**

- **Trái (span 5):** Form thành viên: tên, chọn rank (searchable select nếu nhiều), optional override frame/giờ.
- **Phải (span 7):** List avatar + tên + rank + tốc độ hiệu dụng; filter pill “Tất cả / theo rank” (future-friendly).

---

## 9. Components — Chi tiết UI

### 9.1. Buttons

- **Primary:** Đậm accent, chữ trắng hoặc gần trắng; bóng nhẹ; hover **lift 1px** + brightness.
- **Secondary / Ghost:** Viền hairline + nền glass; hover tăng opacity nền.
- **Danger:** Outline đỏ hoặc fill đỏ nhạt; chỉ dùng cho xóa.

### 9.2. Inputs

- Height **44–48px**, bo góc **12px**.
- Label **trên** input; error message **dưới** màu danger + icon nhỏ.
- Focus: ring **2px** accent + offset **2px**.

### 9.3. Dropdown / Select

- Có thể thiết kế dạng **custom menu glass** (popover blur) — danh sách item height 40px, divider mảnh.

### 9.4. Kết quả (metrics)

- Số lớn: **28–36px** semibold cho metric chính.
- Đơn vị nhỏ hơn **14–16px** regular, cùng baseline.

---

## 10. Iconography & illustration

- Style: **Outline**, stroke đồng nhất, góc bo hiện đại.
- Màu icon default: `text.secondary`; active: `accent.primary`.

---

## 11. Motion & feedback

- Chuyển tab: **cross-fade nhẹ** hoặc **slide 8–12px** content, duration **200–260ms**, easing `standard`.
- Button click: scale **0.98** 80ms.
- Không dùng parallax nặng; ưu tiên **mượt và rõ ràng**.

---

## 12. Accessibility (design acceptance)

- Touch target tối thiểu **44×44px**.
- Focus visible trên mọi control tương tác.
- Không dựa vào màu đơn thuần để truyền đạt trạng thái (kèm text/icon).
- Kiểm tra contrast chữ trên **glass** (nền biến thiên) bằng overlay tối đa cho vùng đọc chính nếu cần.

---

## 13. Responsive checklist

- [ ] Tab bar vẫn **căn giữa**; trên mobile có thể scroll ngang nhẹ *hoặc* chuyển icon-only — phải có label trong tooltip/accessibility.
- [ ] Panel không tràn viewport; padding trong panel giảm proportional.
- [ ] Bảng tab 2/3: trên mobile chuyển **card stack** hoặc horizontal scroll với hint.

---

## 14. Deliverables gợi ý cho designer (Figma)

1. **Frame:** Desktop 1440, Tablet 834, Mobile 390.
2. **Styles:** Colors, Typography, Effects (Glass: blur, fill, stroke, shadow).
3. **Components:** Tab segmented, Input, Select, Button set, Metric card, List row.
4. **Prototype:** Tab switch + form tab 1 → hiện kết quả.

---

## 15. Ghi chú BA — Ngoài scope thiết kế trang chủ

- Logic nghiệp vụ chi tiết (công thức, localStorage) không bắt buộc trong file này; designer chỉ cần **đủ chỗ** và **thứ tự** để dev map data sau này.

---

*Tài liệu này mô tả hướng thiết kế mới, độc lập với implementation hiện tại. Team design có thể thay đổi token cụ thể miễn tuân thủ nguyên tắc: sáng, tương phản, grid chuẩn, tab trung tâm, glass macOS-like.*
