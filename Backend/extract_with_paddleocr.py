import os
import fitz  
import cv2
import numpy as np
from paddleocr import PPStructure

current_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Bỏ qua cảnh báo file PDF
fitz.TOOLS.mupdf_display_errors(False) 

# 2. KHỞI TẠO ENGINE BẰNG PPSTRUCTURE HIỆN ĐẠI
layout_model = os.path.join(current_dir, 'models', 'layout_publaynet_infer')
det_model    = os.path.join(current_dir, 'models', 'ch_PP-OCRv4_det_infer')       
table_model  = os.path.join(current_dir, 'models', 'en_ppstructure_mobile_v2.0_SLANet_infer')

# Trỏ thẳng vào thư mục V5 bạn đã tải thủ công ở bước trước (để đảm bảo Offline)
rec_model    = os.path.join(current_dir, 'models', 'latin_PP-OCRv5_mobile_rec_infer')  

# Trỏ từ điển Latin (chỉ cần file txt thông thường, thư viện mới sẽ tự map đúng)
# dict_path    = os.path.join(current_dir, 'models', 'latin_dict.txt')

print("Đang khởi động AI Engine (Lõi 3.0.0 + Latin V5)...")
table_engine = PPStructure(
    layout_model_dir=layout_model, 
    det_model_dir=det_model,
    rec_model_dir=rec_model,
    table_model_dir=table_model,
    # rec_char_dict_path=dict_path,
    lang='en', # Layout vẫn cần cờ này
    show_log=False,
    use_gpu=False,
    recovery=False # Chặn layer rác của PDF
)

# 3. XỬ LÝ PDF (Giữ nguyên cấu trúc của bạn)
def pdf_to_images(pdf_path):
    doc = fitz.open(pdf_path)
    images = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=200) 
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 4:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        images.append(img)
    return images

def process_invoice(pdf_path):
    print(f"\nĐang xử lý file: {pdf_path}")
    images = pdf_to_images(pdf_path)
    extracted_tables_html = []
    
    for i, img in enumerate(images):
        print(f" -> Đang quét trang {i + 1}...")
        results = table_engine(img)
        for region in results:
            if region['type'] == 'table':
                html_content = region['res']['html']
                extracted_tables_html.append(html_content)
                print("    [!] Đã tìm thấy bảng dữ liệu!")

    return extracted_tables_html


def save_output(tables_html: list[str], output_path: str):
    """Save all extracted tables as a styled HTML file."""
    sections = "\n<hr>\n".join(
        f"<h3>Table {i+1}</h3>\n{html}"
        for i, html in enumerate(tables_html)
    )
    page = f"""<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <title>OCR Extracted Tables</title>
            <style>
                body  {{ font-family: Arial, sans-serif; padding: 24px; font-size: 13px; }}
                table {{ border-collapse: collapse; margin-bottom: 20px; }}
                td, th {{ border: 1px solid #999; padding: 4px 8px; vertical-align: top; }}
                tr:nth-child(even) {{ background: #f5f5f5; }}
                hr {{ margin: 32px 0; border: 2px solid #ddd; }}
            </style>
            </head>
            <body>
            {sections}
            </body>
            </html>"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"\nSaved → {output_path}")
 
 
# ============================================================================
# BONUS: White-fill trick (nuclear option)
# ----------------------------------------------------------------------------
# If recovery=False still doesn't help (some PPStructure versions ignore it),
# this strips ALL selectable text from the PDF before rendering, guaranteeing
# that fitz.get_text() returns nothing. PPStructure then has no choice but to
# rely 100% on the OCR model.
#
# Use this only as a last resort — it creates a modified copy of the PDF.
# ============================================================================
def strip_pdf_text_layer(pdf_path: str, output_path: str):
    """
    Create a copy of the PDF with all text painted over in white.
    This forces PPStructure to use pixel OCR with zero fallback to text layer.
    The visual appearance is preserved — only the invisible text layer changes.
    """
    doc = fitz.open(pdf_path)
    for page in doc:
        # Redact (white-fill) every text span on the page
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") == 0:  # type 0 = text block
                for line in block["lines"]:
                    for span in line["spans"]:
                        rect = fitz.Rect(span["bbox"])
                        page.add_redact_annot(rect, fill=(1, 1, 1))  # white fill
        page.apply_redactions()
    doc.save(output_path)
    print(f"Text-stripped PDF saved → {output_path}")


if __name__ == "__main__":
    sample_pdf = os.path.join(current_dir, "PHONG PHU Quotation_No_1497R2.pdf")
    output_html = os.path.join(current_dir, "ocr_extracted_tables.html")
 
    # ── Option A: Normal run with recovery=False (try this first) ──────────
    if os.path.exists(sample_pdf):
        tables = process_invoice(sample_pdf)
 
        if tables:
            save_output(tables, output_html)
            print(f"\nDone — {len(tables)} table(s) extracted.")
        else:
            print("No tables found. Try Option B below.")
    else:
        print(f"File not found: {sample_pdf}")