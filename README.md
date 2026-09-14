# MT HOUSE — Hệ thống báo cáo công việc

Website nội bộ để **nhân viên tự gửi báo cáo công việc hằng ngày kèm hình ảnh**, quản lý
**duyệt / sửa**, và xem **báo cáo tổng hợp theo tháng** (thay cho việc nhắn Zalo rồi gõ tay
lại vào Excel).

---

## 1. Mở website

Nhấp đúp vào tệp `index.html`. Không cần cài đặt gì thêm, không cần mạng.

Muốn cả công ty mở được bằng đường link thì bật **GitHub Pages**: vào repo trên GitHub →
*Settings* → *Pages* → chọn nhánh `main`, thư mục `/ (root)* → Save. Sau khoảng một phút sẽ
có địa chỉ dạng `https://<tên-tài-khoản>.github.io/<tên-repo>/`. Toàn bộ dự án là tệp tĩnh
nên không cần cấu hình gì thêm — nhưng nhớ rằng **mỗi người mở link sẽ có dữ liệu riêng trên
máy của họ** (xem mục 4).

Đăng nhập bằng **tên đăng nhập** và **mật khẩu**. Tài khoản có sẵn khi mở lần đầu:

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản lý | `admin` | `admin123` |
| Võ Thị Huỳnh Như — Kiến trúc sư | `nhu` | `123456` |
| Trần Minh Khoa — Hoạ viên kiến trúc | `khoa` | `123456` |
| Nguyễn Thị Thu Hà — Thiết kế nội thất | `ha` | `123456` |
| Lê Quốc Bảo — Kỹ sư triển khai | `bao` | `123456` |
| Phạm Ngọc Mai — Diễn hoạ 3D | `mai` | `123456` |

- **Quản lý cấp tài khoản**: Cài đặt → Nhân viên → *Thêm nhân viên* (đặt tên đăng nhập và
  mật khẩu ban đầu). Quên mật khẩu thì vào đây cấp lại.
- **Nhân viên tự đổi mật khẩu**: bấm vào tên mình ở góc trên bên phải → *Đổi mật khẩu*.

---

## 2. Quy trình sử dụng

```
Nhân viên gửi báo cáo  →  Quản lý duyệt / yêu cầu sửa  →  Báo cáo tổng hợp tự động
   (kèm ảnh)                    (hoặc sửa trực tiếp)         (bảng + biểu đồ + lương)
```

### Nhân viên — mục “Gửi báo cáo”
Mỗi đầu việc là một lần gửi. Một ngày có thể gửi nhiều lần.

Màn hình đi theo đúng bốn bước, gói gọn trong một khung hình nên **không phải cuộn xuống**:

1. **Mã công trình**
2. **Hạng mục** — Kiến trúc / Nội thất / Triển khai
3. **Công việc đã làm** — kèm ngày, giờ bắt đầu, giờ kết thúc. Giờ HC và TC **tự tính** theo
   khung giờ, sửa lại được. Ô *lý do / mục tiêu* nằm ẩn, bấm mới hiện (phần này dựng nên mục
   “Phân tích diễn giải” trong báo cáo cuối tháng).
4. **Hình ảnh** — kéo thả, bấm chọn tệp, hoặc **dán thẳng bằng `Ctrl + V`** (tiện khi chụp
   màn hình 3ds Max / bản vẽ). Ảnh tự thu về tối đa 1600px cho nhẹ máy.

Báo cáo gửi lên ở trạng thái **Chờ duyệt**.

### Quản lý — mục “Báo cáo”
- Mở ra là **lọc sẵn những báo cáo đang chờ duyệt**, để việc cần xử lý nằm ngay trước mắt.
  Khi không còn gì chờ duyệt thì tự chuyển sang hiện tất cả, tránh mở ra một trang trống.
  Đổi sang *Tất cả trạng thái* bất cứ lúc nào ở ô **Trạng thái**.
- Lọc theo tháng, nhân viên, trạng thái, hoặc tìm theo nội dung.
- Với mỗi báo cáo: **Duyệt**, **Yêu cầu sửa** (kèm ghi chú gửi lại nhân viên), **Sửa**, **Xoá**.
- Nút **Duyệt tất cả** xử lý nhanh cả hàng đợi.
- Quản lý cũng gửi báo cáo **thay cho nhân viên** được — dùng khi nhân viên vẫn báo qua Zalo.

### Mục “Khách hàng” — hành trình khách hàng
Mỗi hồ sơ khách hàng đi qua **6 bước cố định**, dùng chung cho cả kiến trúc và nội thất:

| # | Bước | Việc chính |
|---|---|---|
| 1 | Tiếp nhận nhu cầu | Khách liên hệ, ghi nhận yêu cầu và diện tích |
| 2 | Khảo sát & báo giá | Đo vẽ hiện trạng, gửi báo giá thiết kế |
| 3 | Ký hợp đồng | Chốt giá, ký hợp đồng và nhận tạm ứng |
| 4 | Thiết kế & duyệt phương án | Mặt bằng công năng, phối cảnh 3D, hồ sơ kỹ thuật |
| 5 | Thi công & giám sát | Xưởng sản xuất, thi công tại công trình |
| 6 | Nghiệm thu & bàn giao | Nghiệm thu, bàn giao và bảo hành |

Sáu bước cộng thẻ *Tất cả* vừa đúng **7 thẻ trên một hàng**. Mỗi bước có **màu riêng**
(xanh dương → cam → xanh ngọc → vàng → tím → xanh lá) để nhìn là biết hồ sơ đang ở đâu. Màu
luôn đi kèm số thứ tự và tên bước nên người không phân biệt được màu vẫn đọc đủ.

> Mã của từng bước đặt theo nghĩa (`lead`, `survey`, `contract`, `design`, `build`,
> `handover`) chứ không đánh số, nên thêm hoặc bớt bước về sau không phải sửa lại dữ liệu cũ.
> Hồ sơ đang ở bước “Triển khai hồ sơ” của bản trước được chuyển về bước *Thiết kế & duyệt
> phương án*.

Trang xếp theo thứ tự: **việc cần làm trước, số liệu tham khảo sau**.

#### Nhắc hẹn chăm sóc khách
Đây là phần trả lời đúng những tình huống thường gặp: *“để chị xem mai chị báo”*,
*“mấy hôm nữa gọi lại”*, *“2–3 tháng nữa nhắc lại”*.

- Mỗi hồ sơ đặt được **một lịch nhắc**: ngày, hình thức (gọi điện / hẹn gặp / gửi hồ sơ /
  việc khác) và nội dung cần nhắc.
- Khi đặt lịch có sẵn nút bấm nhanh: *Ngày mai · 3 ngày · 1 tuần · 2 tuần · 1 tháng ·
  2 tháng · 3 tháng · 6 tháng*, hoặc tự chọn ngày bất kỳ.
- **Khối “Cần liên hệ” nằm trên cùng trang**, gom những khách đã quá hạn và tới hạn hôm nay,
  kèm ba nút xử lý ngay: *Đã liên hệ* (ghi vào lịch sử rồi hỏi luôn lịch hẹn lần sau),
  *Dời 3 ngày*, *Đổi lịch*.
- Màu mức độ gấp tách hẳn khỏi màu thương hiệu để dễ nhận ra: **đỏ** quá hạn, **cam** hôm
  nay, **xanh dương** trong 7 ngày tới, **xám** còn xa, và chữ mờ khi chưa đặt nhắc.
- Số khách cần liên hệ hiện thành **chấm đỏ trên menu “Khách hàng”**, thấy ngay từ bất kỳ
  màn hình nào.
- **Không nhắc nữa**: khách không có nhu cầu tiếp thì bấm nút này trong hộp thoại đặt lịch.
  Hồ sơ chuyển sang trạng thái riêng (viền đứt, chữ xám), không còn nhảy vào khối *Cần liên
  hệ* và không bị đếm là “chưa đặt nhắc”. Muốn theo dõi lại thì mở hồ sơ, chọn ngày rồi lưu.
- Ô lọc *Lịch nhắc* cho xem riêng nhóm: cần liên hệ ngay / trong 7 ngày tới / đã đặt lịch /
  chưa đặt nhắc / không nhắc nữa.
#### Ghi chú khách hàng
Mỗi hồ sơ có một **dòng thời gian ghi chú**, xem trong hồ sơ khách hàng (bấm vào tên khách).
Mỗi mục ghi rõ loại việc, thời điểm và người ghi:

| Loại | Được ghi khi nào |
|---|---|
| Ghi chú | Tự gõ vào ô *Thêm ghi chú* trong hồ sơ khách |
| Kết quả liên hệ | Bấm *Đã liên hệ* — hệ thống **bắt buộc ghi khách nói gì** trước khi lưu |
| Chuyển bước | Tự động, khi đổi bước trong hành trình |
| Đóng / Mở lại hồ sơ | Tự động, kèm lý do đóng |
| Ngưng nhắc | Khi chọn *Không nhắc nữa* |

Khi bấm **Đã liên hệ**, hộp thoại *Kết quả liên hệ* mở ra để ghi lại khách nói gì. Có sẵn
sáu câu bấm nhanh (*không nghe máy*, *khách hẹn xem lại*, *khách đồng ý*, *đang so sánh giá*,
*hẹn gặp trực tiếp*, *khách xin hoãn*) rồi sửa thêm cho đúng. Lưu xong chọn tiếp
*Hẹn lần tới* hoặc *Không nhắc nữa*.

#### Đóng hồ sơ kèm lý do
Đóng hồ sơ **bắt buộc chọn lý do**, chọn trong bảy mục có sẵn: *số rác / không liên hệ được,
khách không còn nhu cầu, vượt ngân sách, khách chọn đơn vị khác, khách hoãn sang dịp khác,
đã hoàn thành & bàn giao, lý do khác* — kèm ô ghi chú thêm. Lý do hiện ngay trên nhãn đỏ
trong bảng danh sách (ví dụ *Số rác / không liên hệ được*) và trên đầu hồ sơ khách, đồng thời
được ghi vào dòng thời gian. Hồ sơ đã đóng vẫn mở lại được bằng nút *Mở lại hồ sơ*.

Bảng bên dưới cho biết mỗi khách đang ở bước nào (có thanh tiến trình 7 vạch), lịch nhắc kế
tiếp, và **đã tiêu bao nhiêu giờ công** lấy tự động từ các báo cáo đã duyệt. Danh sách sắp
xếp theo ngày nhắc gần nhất trước. Quản lý bấm biểu tượng chuông để đặt nhắc, biểu tượng bút
để chuyển bước hoặc đóng hồ sơ.

### Mục “Bảng chấm công”
Dựng lại đúng bảng theo dõi ngày/tháng đang dùng: mỗi dòng một đầu việc, các cột bên phải là
từng ngày trong tháng tách **HC / TC**, dòng cuối là **TỔNG CỘNG HÀNG THÁNG**.
Mặc định chỉ hiện những ngày có dữ liệu — bấm nút để xem đủ 30/31 ngày.

Ô *Nhân viên* chọn được **Tất cả nhân viên** hoặc từng người:

- Chọn **một người**: đầu bảng hiện mức lương tháng, số ngày công và đơn giá giờ của người đó.
- Chọn **tất cả**: bảng thêm cột *Nhân viên*, và bên dưới có thêm bảng **Tổng giờ theo nhân
  viên** (số đầu việc, giờ HC, giờ TC, tổng giờ của từng người) để so sánh nhanh cả nhóm.

File CSV xuất ra đi theo đúng phạm vi đang chọn.

Bảng nhiều cột ngày thì chắc chắn phải kéo, nhưng nút **Xem toàn màn hình** giúp kéo ít hơn
hẳn: bảng chiếm trọn màn hình (bỏ thanh bên và thanh trên), hàng tiêu đề dính lại khi cuộn
dọc, cột công trình vẫn dính bên trái, và có **ba cỡ chữ Nhỏ / Vừa / Lớn** — chọn *Nhỏ* thì
số cột ngày lọt vào màn hình tăng gần gấp đôi. Cỡ chữ đã chọn được nhớ cho lần sau. Bấm
`Esc` hoặc dấu × để thoát.

### Mục “Tổng hợp” — trang quản lý mở ra đầu tiên
Xếp theo thứ tự đọc từ con số xuống chi tiết:

1. **Ba ô số** — tổng giờ HC, tổng giờ TC, tổng lương tháng.
2. **Hai bảng cạnh nhau** — theo công trình và theo hạng mục.
3. **Hai biểu đồ** — thời gian theo công trình và tỷ trọng theo hạng mục.
4. Ba khối **gập lại** (bấm mới mở, để trang không bị rối): *Phân tích diễn giải chi tiết &
   lý do*, *Bảng tính lương*, *Hình ảnh công việc trong tháng*.

Cả mục này và Bảng chấm công đều có **Xuất Excel (CSV)** và **In / Lưu PDF** — bản in luôn
mở sẵn cả ba khối gập.

> Số liệu chỉ tính **báo cáo đã duyệt**. Nếu còn báo cáo chờ duyệt trong tháng, một dòng nhắc
> kèm liên kết *Duyệt ngay* sẽ hiện ngay dưới bộ lọc.

---

## 3. Cách tính lương

Đơn giá một giờ:

```
Đơn giá giờ = Lương tháng ÷ Số ngày công chuẩn ÷ Số giờ làm mỗi ngày
            = 10.000.000 ÷ 22 ÷ 8 = 56.818 VNĐ/giờ
```

Tổng lương tháng (công thức mặc định, khớp với file Excel hiện tại):

```
Tổng lương = Lương cứng tháng + (Giờ TC × Đơn giá giờ × Hệ số tăng ca)
           = 10.000.000 + (30,75 × 56.818 × 1,5) = 12.620.739 VNĐ
```

Trong **Cài đặt → Thông số chung** có thể đổi sang công thức thứ hai
`(Giờ HC + Giờ TC × Hệ số) × Đơn giá giờ`, đổi hệ số tăng ca, số ngày công chuẩn,
số giờ mỗi ngày và khung giờ ca hành chính.

---

## 4. Dữ liệu được lưu ở đâu

Toàn bộ dữ liệu **nằm trong trình duyệt của máy đang mở** (IndexedDB), kể cả ảnh.
Điều đó có nghĩa là:

- Mở bằng máy khác hoặc trình duyệt khác sẽ **không** thấy dữ liệu của máy này.
- Xoá lịch sử duyệt web kiểu “xoá cookie và dữ liệu trang” sẽ mất dữ liệu.
- **Hãy sao lưu định kỳ**: Cài đặt → Dữ liệu → *Tải file sao lưu (.json)*. File này chứa cả
  ảnh và phục hồi lại được trên bất kỳ máy nào.

### Dữ liệu mẫu

Lần mở đầu tiên, hệ thống tự đổ sẵn một bộ dữ liệu đầy đủ để xem được mọi màn hình:

| Mục | Số lượng |
|---|---|
| Nhân viên | 5 người + 1 tài khoản quản lý |
| Hồ sơ khách hàng | 50, rải đều trên 6 bước của hành trình |
| Lịch nhắc | ~4 quá hạn · ~4 tới hạn hôm nay · ~5 “không nhắc nữa” |
| Ghi chú khách | ~77 mục, gồm 4 hồ sơ đã đóng với 4 lý do khác nhau |
| Báo cáo công việc | ~400 đầu việc, trải **3 tháng gần nhất**, cả 5 nhân viên, 18 công trình |
| Trạng thái báo cáo | phần lớn đã duyệt, ~20 chờ duyệt, vài cái bị trả lại để sửa |

Hai điểm đáng chú ý:

- **Dữ liệu bám theo ngày mở trang.** Lịch nhắc và báo cáo đều tính lùi từ hôm nay, nên mở
  lúc nào cũng thấy việc đang diễn ra chứ không phải dữ liệu chết.
- **Tháng 7/2026 của Võ Thị Huỳnh Như được giữ nguyên từng dòng** đúng theo file Excel:
  132 giờ HC, 30,75 giờ TC, lương 12.620.739 VNĐ — để đối chiếu kết quả tính toán.

Mọi thứ đều sinh theo công thức cố định (không dùng số ngẫu nhiên) nên **ai mở cũng thấy
cùng một bộ dữ liệu**. Khi bắt đầu dùng thật, vào **Cài đặt → Dữ liệu → Xoá dữ liệu mẫu,
giữ cấu hình** — nhân viên, công trình và thông số được giữ lại.

### Dùng chung cho cả công ty

Bản hiện tại chạy hoàn toàn trên máy người dùng, phù hợp cho một máy hoặc để chạy thử.
Để nhân viên gửi báo cáo từ điện thoại và quản lý duyệt trên máy khác, cần một máy chủ
lưu dữ liệu chung. Toàn bộ phần truy xuất dữ liệu đã gom vào một chỗ duy nhất là
[js/store.js](js/store.js) — chỉ cần thay các hàm `all / get / put / del / addImage /
imagesOf` bằng lời gọi tới máy chủ, phần giao diện giữ nguyên. Hai hướng thường dùng:

- **Google Sheets + Apps Script** — rẻ, dữ liệu vẫn nằm trong bảng tính quen thuộc.
- **Firebase / Supabase** — có sẵn xác thực người dùng và kho ảnh, đồng bộ tức thời.

Khi lên máy chủ, phần đăng nhập bằng mã PIN cũng nên thay bằng tài khoản thật — PIN hiện
được kiểm tra ngay trên trình duyệt nên chỉ đủ để phân biệt người dùng nội bộ, không phải
một lớp bảo mật.

---

## 5. Cấu trúc tệp

```
BaoCaoMTHouse/
├── index.html          khung trang
├── assets/
│   ├── logo.png        logo vuông — dùng cho trang đăng nhập và favicon
│   └── logo-wide.png   logo ngang — dùng cho thanh trên cùng
├── css/app.css         toàn bộ giao diện + bảng màu lấy từ logo
└── js/
    ├── utils.js        định dạng ngày giờ, tiền, icon, hộp thoại, xuất CSV
    ├── store.js        CSDL, tính lương, dữ liệu mẫu  ← sửa ở đây khi lên máy chủ
    ├── charts.js       biểu đồ cột & vành khuyên (tự vẽ, không thư viện ngoài)
    └── app.js          định tuyến, phân quyền, các màn hình
```

Không dùng thư viện bên ngoài và không gọi mạng — mở offline vẫn chạy đủ chức năng.

---

## 6. Ghi chú kỹ thuật

- **Màu chủ đạo** lấy từ logo: cam `#ED6A1F` → đỏ gạch `#D8451C`, phụ trợ xám thép.
- **Hoạ tiết theo nghề**: nền toàn trang là giấy kẻ ô hai lớp (ô nhỏ 24px, ô lớn 120px) ở độ
  mờ 2–3% như giấy can; thanh trên cùng có vạch chia kiểu thước tỷ lệ mờ dần; tiêu đề mỗi
  trang gạch chân bằng một **đường ghi kích thước** (nét ngang, hai đầu có vạch); trang đăng
  nhập có nét **mặt bằng kiến trúc** chìm ở góc. Tất cả đều ở mức rất nhạt để không cạnh
  tranh với nội dung, và **tự tắt khi in**.
- **Màu biểu đồ** (cam / xanh dương / xanh lá) đã kiểm tra bằng bộ kiểm định mù màu —
  khoảng cách ΔE 9,2 (mù màu) và 24,0 (thị lực thường), đạt ngưỡng an toàn.
- Mỗi phần trăm trên biểu đồ tỷ trọng đều ghi trực tiếp, kèm bảng số bên cạnh, nên người
  không phân biệt được màu vẫn đọc đủ thông tin.
- Ảnh trong danh sách và trong báo cáo chỉ hiện ở cỡ ô vuông nhỏ (~130–150px); bấm vào mới
  mở toàn màn hình, có nút chuyển ảnh và tải về.
- Giao diện chạy tốt từ 375px (điện thoại) tới màn hình lớn; trên điện thoại thanh điều
  hướng nằm dưới đáy, tối đa 5 mục.
- Vùng bấm tối thiểu 40–44px, đi được bằng bàn phím, có viền focus rõ.
