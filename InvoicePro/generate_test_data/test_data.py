# generate_test_data/test_data.py

import pandas as pd
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw

# ─── Ensure uploads folder exists ─────────────────────────────
os.makedirs("uploads", exist_ok=True)


# ─── 10 PDF Invoices ──────────────────────────────────────────
pdf_data = [
    ("INV-001", "Acme Corp",      1500, 270,  "2024-09-01", "Paid"),
    ("INV-002", "Beta Ltd",       3200, 576,  "2024-09-15", "Pending"),
    ("INV-003", "Gamma Inc",       800, 144,  "2024-09-30", "Overdue"),
    ("INV-004", "Delta LLC",      4500, 810,  "2024-10-01", "Paid"),
    ("INV-005", "Epsilon Co",     2200, 396,  "2024-10-15", "Pending"),
    ("INV-006", "Zeta Corp",       950, 171,  "2024-10-20", "Paid"),
    ("INV-007", "Eta Supplies",   6700, 1206, "2024-11-01", "Overdue"),
    ("INV-008", "Theta Works",    3100, 558,  "2024-11-10", "Pending"),
    ("INV-009", "Iota Systems",   1750, 315,  "2024-11-20", "Paid"),
    ("INV-010", "Kappa Tech",     5300, 954,  "2024-12-01", "Pending"),
]

print("📄 Generating PDF invoices...")
for inv_no, vendor, amount, tax, due, status in pdf_data:
    path = f"uploads/{inv_no}.pdf"
    c = canvas.Canvas(path, pagesize=letter)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(200, 750, "INVOICE")
    c.setFont("Helvetica", 12)
    c.drawString(50, 710, f"Invoice No : {inv_no}")
    c.drawString(50, 690, f"Vendor     : {vendor}")
    c.drawString(50, 670, f"Amount     : ${amount}")
    c.drawString(50, 650, f"Tax (18%)  : ${tax}")
    c.drawString(50, 630, f"Total      : ${amount + tax}")
    c.drawString(50, 610, f"Due Date   : {due}")
    c.drawString(50, 590, f"Status     : {status}")
    c.save()
    print(f"   ✅ Created {path}")


# ─── 5 XLSX Invoices ──────────────────────────────────────────
xlsx_data = [
    {
        "Invoice No": ["INV-101", "INV-102", "INV-103"],
        "Vendor":     ["Alpha Traders", "BrightMart", "CloudBase"],
        "Amount":     [2000, 4500, 1100],
        "Tax":        [360, 810, 198],
        "Total":      [2360, 5310, 1298],
        "Due Date":   ["2024-09-05", "2024-09-20", "2024-10-01"],
        "Status":     ["Paid", "Pending", "Overdue"],
    },
    {
        "Invoice No": ["INV-201", "INV-202"],
        "Vendor":     ["DataSync", "EcomWorld"],
        "Amount":     [7800, 3300],
        "Tax":        [1404, 594],
        "Total":      [9204, 3894],
        "Due Date":   ["2024-10-10", "2024-10-25"],
        "Status":     ["Paid", "Pending"],
    },
    {
        "Invoice No": ["INV-301", "INV-302", "INV-303"],
        "Vendor":     ["FastFreight", "GreenGoods", "HubSpot"],
        "Amount":     [500, 1500, 6000],
        "Tax":        [90, 270, 1080],
        "Total":      [590, 1770, 7080],
        "Due Date":   ["2024-11-01", "2024-11-15", "2024-11-30"],
        "Status":     ["Overdue", "Paid", "Pending"],
    },
    {
        "Invoice No": ["INV-401", "INV-402"],
        "Vendor":     ["InfoTech", "JetLogistics"],
        "Amount":     [9500, 2750],
        "Tax":        [1710, 495],
        "Total":      [11210, 3245],
        "Due Date":   ["2024-12-01", "2024-12-15"],
        "Status":     ["Pending", "Paid"],
    },
    {
        "Invoice No": ["INV-501", "INV-502", "INV-503"],
        "Vendor":     ["KeySoft", "LimeWorks", "MegaSupply"],
        "Amount":     [3400, 8800, 1600],
        "Tax":        [612, 1584, 288],
        "Total":      [4012, 10384, 1888],
        "Due Date":   ["2024-12-20", "2025-01-05", "2025-01-15"],
        "Status":     ["Paid", "Pending", "Overdue"],
    },
]

print("\n📊 Generating XLSX invoices...")
for i, data in enumerate(xlsx_data, start=1):
    path = f"uploads/invoices_batch_{i}.xlsx"
    pd.DataFrame(data).to_excel(path, index=False)
    print(f"   ✅ Created {path}")


# ─── 5 Image Invoices ─────────────────────────────────────────
image_data = [
    ("INV-601", "NovaTech",      2100, 378,  "2025-01-20", "Paid"),
    ("INV-602", "OmegaSupplies", 4700, 846,  "2025-02-01", "Pending"),
    ("INV-603", "PrimeCargo",    1300, 234,  "2025-02-15", "Overdue"),
    ("INV-604", "QuantumIT",     5600, 1008, "2025-03-01", "Paid"),
    ("INV-605", "RapidFreight",   900, 162,  "2025-03-15", "Pending"),
]

print("\n🖼️  Generating Image invoices...")
for inv_no, vendor, amount, tax, due, status in image_data:
    path = f"uploads/{inv_no}.png"
    img = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 580, 380], outline="black", width=2)
    draw.text((230, 40),  "INVOICE",                      fill="black")
    draw.text((50, 100),  f"Invoice No : {inv_no}",       fill="black")
    draw.text((50, 130),  f"Vendor     : {vendor}",       fill="black")
    draw.text((50, 160),  f"Amount     : ${amount}",      fill="black")
    draw.text((50, 190),  f"Tax (18%)  : ${tax}",         fill="black")
    draw.text((50, 220),  f"Total      : ${amount + tax}", fill="black")
    draw.text((50, 250),  f"Due Date   : {due}",          fill="black")
    draw.text((50, 280),  f"Status     : {status}",       fill="black")
    img.save(path)
    print(f"   ✅ Created {path}")

print("\n✅ All 20 files created in uploads/")