// Mock CSV fixture — matches the 2-page test PDF (ILT Optics + Pearl Vision)
// Used when MOCK_GEMINI=true in .env
// To switch back to real Gemini: set MOCK_GEMINI=false (or remove the line)

export const MOCK_EXTRACTION_CSV = `company_name,outlet_code,document_category,debit,credit,vendor_code,vendor_name,account_code,account_description,cn_number,invoice_number,date,line_items_count,calculation_trace,total_amount,document_type,document_description,file_name,page_number,confidence,extraction_remarks
MCT VISION SDN BHD,F5063,SOA,332.00,,,ILT OPTICS (M) SDN BHD,,,, 107000467547,2025-12-12,1,,332.00,SOA,SALES,test-invoice1.pdf,1,0.95,Single invoice line — Essilor Pro SOA via ILT Optics
MCT VISION SDN BHD,F5063,PAYMENT,,329.00,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, OR00026066,2025-12-17,1,,329.00,PAYMENT,INV : NOV'25,test-invoice1.pdf,2,0.97,Payment RV type — clearing Nov invoices
MCT VISION SDN BHD,F5063,SOA,121.00,,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, 01061190,2025-12-11,1,,121.00,SOA,SALES,test-invoice1.pdf,2,0.95,
MCT VISION SDN BHD,F5063,SOA,102.00,,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, 01062834,2025-12-08,1,,102.00,SOA,SALES,test-invoice1.pdf,2,0.95,
MCT VISION SDN BHD,F5063,SOA,108.00,,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, 01067970,2025-12-27,1,,108.00,SOA,SALES,test-invoice1.pdf,2,0.95,
MCT VISION SDN BHD,F5063,SOA,143.00,,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, 01068322,2025-12-29,1,,143.00,SOA,SALES,test-invoice1.pdf,2,0.95,
MCT VISION SDN BHD,F5063,SOA,450.00,,,ESSILOR MANUFACTURING (M) SDN BHD,,,, INV-2025-8821,2025-12-05,1,,450.00,SOA,PROGRESSIVE LENS SUPPLY,test-invoice1.pdf,3,0.42,Blurry scan on page 3 — low confidence
MCT VISION SDN BHD,F5063,SOA,280.00,,,NOVA OPTIC TRADING SDN BHD,,,, INV-2025-9042,2025-12-14,1,,280.00,SOA,FRAME SUPPLY DEC,test-invoice1.pdf,3,0.91,
MCT VISION SDN BHD,F5063,PAYMENT,,560.00,,NOVA OPTIC TRADING SDN BHD,,,, OR-2025-0447,2025-12-20,1,,560.00,PAYMENT,PAYMENT NOV BALANCE,test-invoice1.pdf,4,0.93,
MCT VISION SDN BHD,F5063,PAYMENT,,195.00,,PEARL VISION OPHTHALMIC LENS SDN. BHD.,,,, OR00027001,2025-12-22,1,,195.00,PAYMENT,PAYMENT DEC ADJUSTMENT,test-invoice1.pdf,4,0.35,Handwritten note obscures amount — low confidence
`;