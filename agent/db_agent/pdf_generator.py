"""
Generatore di PDF per i risultati delle query sul database.
"""

import os
import logging
import json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch, cm

# Configurazione logging
logger = logging.getLogger('pdf_generator')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Directory per i report
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'reports')
os.makedirs(REPORTS_DIR, exist_ok=True)

class PDFGenerator:
    """Classe per generare PDF dai risultati delle query"""
    
    def __init__(self):
        """Inizializza il generatore PDF"""
        self.styles = getSampleStyleSheet()
        # Aggiungi stile personalizzato per il titolo
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=16,
            spaceAfter=12
        ))
        # Aggiungi stile personalizzato per la descrizione
        self.styles.add(ParagraphStyle(
            name='Description',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=12,
            textColor=colors.darkblue
        ))
        logger.info("PDFGenerator inizializzato")
    
    def generate_pdf(self, query_results, title=None, description=None):
        """
        Genera un PDF dai risultati della query
        
        Args:
            query_results: Risultati della query
            title: Titolo del report
            description: Descrizione del report
            
        Returns:
            dict: Informazioni sul file PDF generato
        """
        try:
            # Crea un nome file univoco
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"report_{timestamp}.pdf"
            filepath = os.path.join(REPORTS_DIR, filename)
            
            logger.info(f"Generazione PDF: {filepath}")
            
            # Crea il documento
            doc = SimpleDocTemplate(
                filepath,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72
            )
            
            # Elementi del documento
            elements = []
            
            # Aggiungi titolo
            report_title = title or "Report Query Database"
            elements.append(Paragraph(report_title, self.styles['CustomTitle']))
            elements.append(Spacer(1, 0.25*inch))
            
            # Aggiungi data e ora
            date_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            elements.append(Paragraph(f"Generato il: {date_str}", self.styles['Normal']))
            elements.append(Spacer(1, 0.25*inch))
            
            # Aggiungi descrizione
            if description or (query_results.get('description')):
                desc_text = description or query_results.get('description')
                elements.append(Paragraph(f"Descrizione: {desc_text}", self.styles['Description']))
                elements.append(Spacer(1, 0.25*inch))
            
            # Aggiungi query SQL
            if query_results.get('query'):
                elements.append(Paragraph("Query SQL:", self.styles['Heading3']))
                elements.append(Paragraph(query_results['query'], self.styles['Code']))
                elements.append(Spacer(1, 0.25*inch))
            
            # Aggiungi risultati
            if query_results.get('success') and query_results.get('rows'):
                # Numero di risultati
                elements.append(Paragraph(f"Risultati: {len(query_results['rows'])} record", self.styles['Normal']))
                elements.append(Spacer(1, 0.25*inch))
                
                # Tabella dei risultati
                if query_results.get('columns') and query_results.get('rows'):
                    # Prepara i dati della tabella
                    table_data = [query_results['columns']]  # Intestazioni
                    
                    # Aggiungi le righe
                    for row in query_results['rows']:
                        # Converti tutti i valori in stringhe
                        table_data.append([str(row.get(col, '')) for col in query_results['columns']])
                    
                    # Crea la tabella
                    table = Table(table_data, repeatRows=1)
                    
                    # Stile della tabella
                    table_style = TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 8),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ])
                    
                    # Applica lo stile alla tabella
                    table.setStyle(table_style)
                    
                    # Aggiungi la tabella al documento
                    elements.append(table)
            else:
                # Messaggio di errore
                error_msg = query_results.get('error', 'Nessun risultato trovato')
                elements.append(Paragraph(f"Errore: {error_msg}", self.styles['Normal']))
            
            # Costruisci il documento
            doc.build(elements)
            
            logger.info(f"PDF generato con successo: {filepath}")
            
            # Restituisci le informazioni sul file
            return {
                "success": True,
                "filename": filename,
                "filepath": filepath,
                "url": f"/uploads/reports/{filename}",
                "timestamp": timestamp
            }
            
        except Exception as e:
            logger.error(f"Errore nella generazione del PDF: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }

# Funzione di utilità per test
def test_pdf_generation():
    """Test della generazione di PDF"""
    # Dati di esempio
    sample_results = {
        "success": True,
        "query": "SELECT m.id, m.text, u.display_name, m.created_at FROM messages m JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT 5",
        "description": "Ultimi 5 messaggi con nome utente",
        "columns": ["id", "text", "display_name", "created_at"],
        "rows": [
            {"id": 1, "text": "Ciao a tutti!", "display_name": "John Doe", "created_at": "2023-01-01 12:00:00"},
            {"id": 2, "text": "Come va?", "display_name": "Jane Smith", "created_at": "2023-01-01 12:05:00"},
            {"id": 3, "text": "Tutto bene, grazie!", "display_name": "John Doe", "created_at": "2023-01-01 12:10:00"},
            {"id": 4, "text": "Qualcuno ha novità sul progetto?", "display_name": "Mark Johnson", "created_at": "2023-01-01 12:15:00"},
            {"id": 5, "text": "Stiamo procedendo bene", "display_name": "Jane Smith", "created_at": "2023-01-01 12:20:00"}
        ],
        "count": 5
    }
    
    # Genera il PDF
    generator = PDFGenerator()
    result = generator.generate_pdf(sample_results, "Report di Test", "Questo è un report di test")
    
    print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    # Test della generazione di PDF
    test_pdf_generation()