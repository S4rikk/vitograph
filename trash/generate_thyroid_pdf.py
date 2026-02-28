import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_thyroid_pdf(filename="thyroid_test_results.pdf"):
    c = canvas.Canvas(filename, pagesize=letter)
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "VITOGRAPH MEDICAL LABORATORY - PATIENT RESULTS")
    
    c.setFont("Helvetica", 12)
    c.drawString(50, 710, "Patient: Anna Ivanova")
    c.drawString(50, 690, "Age: 32")
    c.drawString(50, 670, "Sex: Female")
    c.drawString(50, 650, "Date: 2026-02-20")
    
    c.drawString(50, 600, "-" * 80)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 580, "Test Name                  Result      Unit       Reference Range")
    c.setFont("Helvetica", 12)
    c.drawString(50, 560, "-" * 80)
    
    # Thyroid panel (not yet explicitly parsed by parser, but good for context)
    c.drawString(50, 540, "TSH (Thyroid Stim. Horm.) 4.8         mIU/L      0.4 - 4.0   (High)")
    c.drawString(50, 520, "Free T4                   11.2        pmol/L     10.0 - 22.0 (Low-Normal)")
    c.drawString(50, 500, "Anti-TPO                  150         IU/mL      < 34        (High)")
    
    # Biomarkers currently supported by VITOGRAPH parsed regex
    c.drawString(50, 460, "Ferritin                  15.5        ng/ml      30 - 200    (Low)")
    c.drawString(50, 440, "Vitamin D                 22.0        ng/ml      30 - 100    (Low)")
    c.drawString(50, 420, "Vitamin B12               310         pg/ml      200 - 900   (Optimal)")
    c.drawString(50, 400, "Glucose                   4.8         mmol/l     3.3 - 6.1   (Optimal)")
    c.drawString(50, 380, "Iron                      12.5        umol/l     10 - 30     (Optimal)")
    c.drawString(50, 360, "Cholesterol               5.8         mmol/l     3.0 - 5.5   (High)")
    
    c.drawString(50, 320, "-" * 80)
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 300, "Comment: Patient presents with fatigue, cold intolerance, and mild weight gain.")
    c.drawString(50, 285, "Results indicate subclinical hypothyroidism linked to autoimmune thyroiditis (Hashimoto's).")
    c.drawString(50, 270, "Concomitant iron (ferritin) and Vitamin D deficiency observed, common in thyroid disorders.")
    
    c.save()
    print(f"Generated {filename} successfully.")

if __name__ == "__main__":
    create_thyroid_pdf()
